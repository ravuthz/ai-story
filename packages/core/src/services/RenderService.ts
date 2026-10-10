import type { ProjectRepository } from "../db/repositories/ProjectRepository";
import type { SceneRepository } from "../db/repositories/SceneRepository";
import type { CategoryRegistry } from "../domain/categories/CategoryRegistry";
import { rm } from "node:fs/promises";
import type { Project, Scene, Story, StorySettings } from "../domain/types";
import { StoryPromptBuilder } from "../prompts/StoryPromptBuilder";
import type { ProviderRegistry } from "../providers/ProviderRegistry";
import { Ffmpeg } from "../providers/video/Ffmpeg";
import type { ProjectStorage } from "../storage/ProjectStorage";
import { mapLimit } from "../utils/text";
import type { StoryService, StoryWithScenes } from "./StoryService";

export const RENDER_STEPS = ["images", "audios", "videos", "final"] as const;
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

/** Turns a scripted story into images, narration, motion clips and a final video. */
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
      const total = steps.size * targets.length + (steps.has("final") ? 1 : 0);
      let done = 0;
      const tick = (message: string) => onProgress(++done / total, message);

      // Images and audio are independent; clips need both, so they run after.
      for (const group of [["images", "audios"], ["videos"]] as const) {
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
    const file = (ext: string) => this.storage.assetPath(project.slug, story.slug, step, `scene-${String(scene.index + 1).padStart(2, "0")}${ext}`);
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
        const narration = settings.narrationLanguage === "en" ? current.text : current.narration;
        const path = await this.providers.get("audio", settings.providers.audio).synthesize({
          text: narration,
          language: settings.narrationLanguage,
          voice: settings.voice,
          voiceMode: settings.voiceMode,
          voiceDescription: settings.voiceDescription,
          outPath: file(".mp3"),
        });
        this.scenes.update(scene.id, { audioPath: rel(path) });
        return;
      }
      case "videos": {
        if (current.videoPath && !force) return;
        if (!current.imagePath) throw new Error(`Scene ${scene.index + 1} has no image yet`);
        const audioPath = current.audioPath ? this.storage.toAbsolute(current.audioPath) : null;
        const fit = await this.planFit(current.durationSec, audioPath, settings, file(".fit.mp3"));
        try {
          const path = await this.providers.get("video", settings.providers.video).renderClip({
            clip: {
              imagePath: this.storage.toAbsolute(current.imagePath),
              audioPath: fit.audioPath,
              durationSec: fit.durationSec,
              motion: current.motion,
              prompt: current.imagePrompt,
            },
            aspectRatio: settings.aspectRatio,
            outPath: file(".mp4"),
          });
          if (fit.trimSec) await Ffmpeg.trimClip(path, fit.trimSec);
          this.scenes.update(scene.id, { videoPath: rel(path) });
        } finally {
          if (fit.audioPath !== audioPath) await rm(fit.audioPath!, { force: true });
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
  ): Promise<{ durationSec: number; audioPath: string | null; trimSec?: number }> {
    const plain = { durationSec: sceneSec, audioPath };
    if (!audioPath || !(fitAudio || fitVideo)) return plain;
    const narrationSec = await Ffmpeg.probeDuration(audioPath);
    if (!narrationSec) return plain;
    // Same tail padding Ffmpeg.clipDuration adds, so the clip ends just after the narration.
    const audioSec = Math.round((narrationSec + Ffmpeg.NARRATION_TAIL_SEC) * 10) / 10;
    if (fitAudio && sceneSec > audioSec) return speedUpVideo ? { ...plain, durationSec: audioSec } : { ...plain, trimSec: audioSec };
    if (fitVideo && audioSec > sceneSec) {
      if (!speedUpAudio) return { ...plain, trimSec: sceneSec };
      return { ...plain, audioPath: await Ffmpeg.speedUpToFit(audioPath, Math.max(0.5, sceneSec - Ffmpeg.NARRATION_TAIL_SEC), fastAudioPath) };
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
}
