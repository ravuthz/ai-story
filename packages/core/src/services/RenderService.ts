import type { ProjectRepository } from "../db/repositories/ProjectRepository";
import type { SceneRepository } from "../db/repositories/SceneRepository";
import type { CategoryRegistry } from "../domain/categories/CategoryRegistry";
import { rm, writeFile } from "node:fs/promises";
import { MOTION_TYPES, type Project, type Scene, type Story, type StorySettings } from "../domain/types";
import { StoryPromptBuilder } from "../prompts/StoryPromptBuilder";
import type { ProviderRegistry } from "../providers/ProviderRegistry";
import { Ffmpeg } from "../providers/video/Ffmpeg";
import type { ProjectStorage } from "../storage/ProjectStorage";
import { writeBytes } from "../utils/media";
import { buildAss, chunkSubtitles, fitCuesToClip, subtitleLayout, timeCues, type SceneSubtitles } from "../utils/subtitles";
import { mapLimit } from "../utils/text";
import type { StoryService, StoryWithScenes } from "./StoryService";

/** Pipeline order: images → narration → subtitles → clips (subtitles burned in) → final cut. */
export const RENDER_STEPS = ["images", "audios", "subtitles", "videos", "final"] as const;
export type RenderStep = (typeof RENDER_STEPS)[number];

export interface RenderOptions {
  steps?: RenderStep[];
  /** Regenerate assets even if they already exist. */
  force?: boolean;
  /** Restrict to specific scene ids. */
  sceneIds?: string[];
  concurrency?: number;
}

export type ProgressFn = (progress: number, message: string) => void;

interface SceneTask {
  step: Exclude<RenderStep, "final">;
  scene: Scene;
}

/** Turns a scripted story into images, narration, subtitles, motion clips and a final video. */
export class RenderService {
  private readonly prompts = new StoryPromptBuilder();

  constructor(
    private readonly storyService: StoryService,
    private readonly scenes: SceneRepository,
    private readonly projects: ProjectRepository,
    private readonly categories: CategoryRegistry,
    private readonly providers: ProviderRegistry,
    private readonly storage: ProjectStorage,
  ) {}

  async render(storyId: string, options: RenderOptions = {}, onProgress: ProgressFn = () => {}): Promise<StoryWithScenes> {
    const steps = new Set(options.steps ?? RENDER_STEPS);
    const story = this.storyService.get(storyId);
    if (!story.scenes.length) throw new Error("Story has no scenes; generate the script first");
    const project = this.projects.getById(story.projectId);
    await this.storage.ensureStory(project.slug, story.slug);
    this.storyService.touch(storyId, { status: "rendering", error: null });

    try {
      const targets = options.sceneIds ? story.scenes.filter((s) => options.sceneIds!.includes(s.id)) : story.scenes;
      const sceneSteps = RENDER_STEPS.filter((step) => step !== "final" && steps.has(step)).length;
      const total = Math.max(1, sceneSteps * targets.length + (steps.has("final") ? 1 : 0));
      let done = 0;
      const tick = (message: string) => onProgress(++done / total, message);

      // Images and audio are independent; subtitles are timed to the audio; clips need all of them.
      for (const group of [["images", "audios"], ["subtitles"], ["videos"]] as const) {
        const tasks: SceneTask[] = group.flatMap((step) => (steps.has(step) ? targets.map((scene) => ({ step, scene })) : []));
        // Let every task in the group finish so successful assets are kept, then report all failures.
        const failures: string[] = [];
        await mapLimit(tasks, options.concurrency ?? 2, async (task) => {
          const label = `${task.step}: scene ${task.scene.index + 1}`;
          try {
            await this.runSceneStep(story, project, task, !!options.force);
            tick(label);
          } catch (error) {
            failures.push(`${label} — ${(error as Error).message}`);
          }
        });
        if (failures.length) throw new Error(failures.join("\n"));
      }

      if (steps.has("final")) {
        await this.composeFinal(story.id, project);
        tick("final video");
      }
      this.storyService.touch(storyId, { status: "done" });
      return this.storyService.writeManifest(storyId);
    } catch (error) {
      this.storyService.touch(storyId, { status: "failed", error: (error as Error).message });
      throw error;
    }
  }

  private async runSceneStep(story: Story, project: Project, { step, scene }: SceneTask, force: boolean) {
    // Always re-read: a previous step may have filled in paths.
    const current = this.scenes.getById(scene.id);
    const name = `scene-${String(scene.index + 1).padStart(2, "0")}`;
    const file = (ext: string) => this.storage.assetPath(project.slug, story.slug, step, `${name}${ext}`);
    const subtitlesFile = this.storage.assetPath(project.slug, story.slug, "subtitles", `${name}.json`);
    const rel = (abs: string) => this.storage.toRelative(abs);
    const { settings } = story;

    switch (step) {
      case "images": {
        if (current.imagePath && !force) return;
        const category = this.categories.get(story.category);
        const path = await this.providers.get("image", settings.providers.image).generate({
          prompt: this.prompts.imagePrompt(current.imagePrompt, settings.imageStyle, category),
          aspectRatio: settings.aspectRatio,
          outPath: file(".png"),
        });
        this.scenes.update(scene.id, { imagePath: rel(path) });
        return;
      }
      case "audios": {
        if (current.audioPath && !force) return;
        const path = await this.providers.get("audio", settings.providers.audio).synthesize({
          text: this.subtitleText(story, current),
          language: settings.narrationLanguage,
          voice: settings.voice,
          voiceMode: settings.voiceMode,
          voiceDescription: settings.voiceDescription,
          outPath: file(".mp3"),
        });
        // New narration invalidates subtitles timed to the old one.
        this.scenes.update(scene.id, { audioPath: rel(path), subtitlePath: null });
        return;
      }
      case "subtitles": {
        if (current.subtitlePath && !force && (await this.loadSubtitles(story, current))) return;
        await this.writeSubtitles(story, current, subtitlesFile);
        return;
      }
      case "videos": {
        if (current.videoPath && !force) return;
        if (!current.imagePath) throw new Error(`Scene ${scene.index + 1} has no image yet`);
        const audioPath = current.audioPath ? this.storage.toAbsolute(current.audioPath) : null;
        const fit = await this.planFit(current.durationSec, audioPath, settings, file(".fit.mp3"));
        const motion = settings.randomMotion ? MOTION_TYPES[Math.floor(Math.random() * MOTION_TYPES.length)]! : current.motion;
        try {
          const path = await this.providers.get("video", settings.providers.video).renderClip({
            clip: {
              imagePath: this.storage.toAbsolute(current.imagePath),
              audioPath: fit.audioPath,
              durationSec: fit.durationSec,
              motion,
              prompt: current.imagePrompt,
            },
            aspectRatio: settings.aspectRatio,
            outPath: file(".mp4"),
          });
          if (fit.trimSec) await Ffmpeg.trimClip(path, fit.trimSec);
          if (settings.subtitleStyle && settings.subtitleStyle !== "none") await this.burnSubtitles(story, current, path, fit.tempo, subtitlesFile);
          this.scenes.update(scene.id, { videoPath: rel(path), motion });
        } finally {
          if (fit.audioPath !== audioPath) await rm(fit.audioPath!, { force: true });
          await rm(file(".ass"), { force: true });
        }
        return;
      }
    }
  }

  /**
   * How a clip is matched to its narration (stored files are never changed):
   * - fitAudio, video longer than audio: render the clip at the audio length (speedUpVideo) or cut it there.
   * - fitVideo, audio longer than video: play a sped-up copy of the audio (speedUpAudio) or cut the clip at the scene length.
   */
  private async planFit(
    sceneSec: number,
    audioPath: string | null,
    { fitAudio, fitVideo, speedUpVideo, speedUpAudio }: StorySettings,
    fastAudioPath: string,
  ): Promise<{ durationSec: number; audioPath: string | null; trimSec?: number; tempo: number }> {
    const plain = { durationSec: sceneSec, audioPath, tempo: 1 };
    if (!audioPath || !(fitAudio || fitVideo)) return plain;
    const narrationSec = await Ffmpeg.probeDuration(audioPath);
    if (!narrationSec) return plain;
    // Same tail padding Ffmpeg.clipDuration adds, so the clip ends just after the narration.
    const audioSec = Math.round((narrationSec + Ffmpeg.NARRATION_TAIL_SEC) * 10) / 10;
    if (fitAudio && sceneSec > audioSec) return speedUpVideo ? { ...plain, durationSec: audioSec } : { ...plain, trimSec: audioSec };
    if (fitVideo && audioSec > sceneSec) {
      if (!speedUpAudio) return { ...plain, trimSec: sceneSec };
      const fast = await Ffmpeg.speedUpToFit(audioPath, Math.max(0.5, sceneSec - Ffmpeg.NARRATION_TAIL_SEC), fastAudioPath);
      return { ...plain, audioPath: fast.path, tempo: fast.tempo };
    }
    return plain;
  }

  private async composeFinal(storyId: string, project: Project): Promise<void> {
    const story = this.storyService.get(storyId);
    const missing = story.scenes.filter((s) => !s.videoPath);
    if (missing.length) throw new Error(`Scenes missing clips: ${missing.map((s) => s.index + 1).join(", ")}`);
    const out = this.storage.finalVideoPath(project.slug, story.slug);
    await Ffmpeg.concat(story.scenes.map((s) => this.storage.toAbsolute(s.videoPath!)), out);
    this.storyService.touch(storyId, { videoPath: this.storage.toRelative(out) });
  }

  /** The text that is narrated (and subtitled) for a scene. */
  private subtitleText(story: Story, scene: Scene): string {
    return story.settings.narrationLanguage === "en" ? scene.text : scene.narration;
  }

  /** Stored cues, or null when missing or built from other text / another line width (style or aspect changed). */
  private async loadSubtitles(story: Story, scene: Scene): Promise<SceneSubtitles | null> {
    if (!scene.subtitlePath) return null;
    const { narrationLanguage, aspectRatio, subtitleStyle } = story.settings;
    try {
      const data = (await Bun.file(this.storage.toAbsolute(scene.subtitlePath)).json()) as SceneSubtitles;
      const fresh = data.text === this.subtitleText(story, scene) && data.lineWidth === subtitleLayout(aspectRatio, narrationLanguage, subtitleStyle).lineWidth;
      return fresh ? data : null;
    } catch {
      return null;
    }
  }

  /** Splits the narration into ≤2-line cues timed to the speech heard in the scene's narration audio. */
  private async writeSubtitles(story: Story, scene: Scene, outPath: string): Promise<SceneSubtitles> {
    if (!scene.audioPath) throw new Error(`Scene ${scene.index + 1} has no narration yet`);
    const { narrationLanguage: language, aspectRatio, subtitleStyle } = story.settings;
    const text = this.subtitleText(story, scene);
    const { lineWidth } = subtitleLayout(aspectRatio, language, subtitleStyle);
    const spans = await Ffmpeg.speechSpans(this.storage.toAbsolute(scene.audioPath));
    const data: SceneSubtitles = { text, lineWidth, cues: timeCues(chunkSubtitles(text, language, lineWidth), spans) };
    await writeBytes(outPath, new TextEncoder().encode(JSON.stringify(data, null, 2)));
    this.scenes.update(scene.id, { subtitlePath: this.storage.toRelative(outPath) });
    return data;
  }

  /** Burns the scene's subtitles into its rendered clip, preparing them first if missing or stale. */
  private async burnSubtitles(story: Story, scene: Scene, clipPath: string, tempo: number, jsonPath: string): Promise<void> {
    if (!scene.audioPath) return;
    const { narrationLanguage, aspectRatio, subtitleStyle } = story.settings;
    const data = (await this.loadSubtitles(story, scene)) ?? (await this.writeSubtitles(story, scene, jsonPath));
    const cues = fitCuesToClip(data.cues, tempo, await Ffmpeg.probeDuration(clipPath), Ffmpeg.FADE_SEC);
    if (!cues.length) return;
    const assPath = clipPath.replace(/\.mp4$/, ".ass");
    await writeFile(assPath, buildAss(cues, subtitleLayout(aspectRatio, narrationLanguage, subtitleStyle)));
    await Ffmpeg.burnSubtitles(clipPath, assPath);
  }
}
