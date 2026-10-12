import { z } from "zod";
import type { ProjectRepository } from "../db/repositories/ProjectRepository";
import type { SceneRepository } from "../db/repositories/SceneRepository";
import type { StoryRepository } from "../db/repositories/StoryRepository";
import { BlueprintGenerator } from "../domain/BlueprintGenerator";
import type { CategoryRegistry } from "../domain/categories/CategoryRegistry";
import {
  MOTION_TYPES,
  PartialSettingsSchema,
  StorySettingsSchema,
  type CategoryId,
  type MotionType,
  type Scene,
  type Story,
  type StorySettings,
} from "../domain/types";
import type { CustomScript } from "../domain/schemas";
import { STORY_JSON_SCHEMA, StoryPromptBuilder, type GeneratedStory } from "../prompts/StoryPromptBuilder";
import type { ProviderRegistry } from "../providers/ProviderRegistry";
import type { ProjectStorage } from "../storage/ProjectStorage";
import { extractJson, newId, nowIso, slugify } from "../utils/text";

const GeneratedStorySchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().default(""),
  moral: z.string().default(""),
  scenes: z
    .array(
      z.object({
        text: z.string().min(1),
        narration: z.string().min(1),
        imagePrompt: z.string().min(1),
        motion: z.string().default("zoom-in"),
      }),
    )
    .min(1),
});

export type StoryWithScenes = Story & { scenes: Scene[] };

export type ScenePatch = Partial<Pick<Scene, "text" | "narration" | "imagePrompt" | "motion" | "durationSec">>;

/** Placeholder title of a custom story until its script is split (the title then comes from the script). */
const UNTITLED = "Untitled story";

export class StoryService {
  private readonly blueprints: BlueprintGenerator;
  private readonly prompts = new StoryPromptBuilder();

  constructor(
    private readonly stories: StoryRepository,
    private readonly scenes: SceneRepository,
    private readonly projects: ProjectRepository,
    private readonly categories: CategoryRegistry,
    private readonly providers: ProviderRegistry,
    private readonly storage: ProjectStorage,
  ) {
    this.blueprints = new BlueprintGenerator(stories);
  }

  list(filter: { projectId?: string; category?: CategoryId; status?: string; limit?: number; offset?: number } = {}) {
    const where = { project_id: filter.projectId, category: filter.category, status: filter.status };
    return {
      total: this.stories.count(where),
      items: this.stories.list({ where, orderBy: "created_at DESC", limit: filter.limit ?? 50, offset: filter.offset }),
    };
  }

  get(id: string): StoryWithScenes {
    return { ...this.stories.getById(id), scenes: this.scenes.listByStory(id) };
  }

  stats() {
    const counts = this.stories.countByCategory();
    return this.categories.list().map((c) => ({ category: c.id, count: counts[c.id] ?? 0, capacity: c.capacity }));
  }

  /**
   * Reserves a unique blueprint and stores a draft story (no LLM call yet).
   * With `custom`, the story is the user's own script ("Create story").
   */
  createDraft(projectId: string, category: CategoryId, settings: Partial<StorySettings> = {}, reserved?: Set<string>, custom?: CustomScript): Story {
    this.projects.getById(projectId);
    const blueprint = this.blueprints.next(this.categories.get(category), reserved);
    const id = newId();
    const now = nowIso();
    return this.stories.insert({
      id,
      projectId,
      category,
      title: custom ? custom.title || UNTITLED : `${blueprint.theme} (${blueprint.tone})`,
      slug: `${category}-${id.slice(0, 8)}`,
      synopsis: "",
      moral: "",
      status: "draft",
      blueprint,
      settings: StorySettingsSchema.parse(settings),
      script: custom?.script ?? null,
      videoPath: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Calls the text provider and stores the script + scenes. Retries once on malformed output.
   * A custom story's own script is split into scenes (keeping its title) instead of writing a new story.
   */
  async generateScript(storyId: string): Promise<StoryWithScenes> {
    const story = this.touch(storyId, { status: "generating", error: null });
    try {
      const category = this.categories.get(story.category);
      const title = story.script && story.title !== UNTITLED ? story.title : undefined;
      const prompt = story.script
        ? this.prompts.fromScript(category, story.settings, story.script, title)
        : this.prompts.build(category, story.blueprint, story.settings);
      const generated = await this.requestScript(story, prompt);
      if (title) generated.title = title;
      // The folder name is derived from the first title only, so regenerating never orphans assets.
      const isFirstScript = this.scenes.count({ story_id: story.id }) === 0;
      const slug = isFirstScript ? `${slugify(generated.title, 50)}-${story.id.slice(0, 6)}` : story.slug;
      this.scenes.replaceForStory(story.id, this.toScenes(story, generated));
      this.touch(story.id, { title: generated.title, synopsis: generated.synopsis, moral: generated.moral, slug, status: "scripted" });
      return this.writeManifest(story.id);
    } catch (error) {
      this.touch(story.id, { status: "failed", error: (error as Error).message });
      throw error;
    }
  }

  updateSettings(storyId: string, patch: Partial<StorySettings>): Story {
    const story = this.stories.getById(storyId);
    return this.touch(storyId, { settings: StorySettingsSchema.parse({ ...story.settings, ...PartialSettingsSchema.parse(patch) }) });
  }

  updateScene(sceneId: string, patch: ScenePatch): Scene {
    const scene = this.scenes.update(sceneId, patch);
    this.touch(scene.storyId, {});
    return scene;
  }

  /** Re-splits the story's configured duration evenly across its scenes. */
  redistributeDurations(storyId: string): Scene[] {
    const story = this.stories.getById(storyId);
    const scenes = this.scenes.listByStory(storyId);
    const each = story.settings.durationSec / Math.max(1, scenes.length);
    return scenes.map((s) => this.scenes.update(s.id, { durationSec: each }));
  }

  async delete(id: string): Promise<void> {
    const story = this.stories.getById(id);
    const project = this.projects.getById(story.projectId);
    this.stories.delete(id);
    await this.storage.removeStory(project.slug, story.slug);
  }

  touch(id: string, patch: Partial<Story>): Story {
    return this.stories.update(id, { ...patch, updatedAt: nowIso() });
  }

  async writeManifest(storyId: string): Promise<StoryWithScenes> {
    const full = this.get(storyId);
    const project = this.projects.getById(full.projectId);
    await this.storage.ensureStory(project.slug, full.slug);
    await this.storage.writeManifest(project.slug, full.slug, full);
    return full;
  }

  private async requestScript(story: Story, prompt: string): Promise<GeneratedStory> {
    const provider = this.providers.get("text", story.settings.providers.text);
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const output = await provider.complete({ prompt, jsonSchema: STORY_JSON_SCHEMA });
        return GeneratedStorySchema.parse(extractJson(output));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private toScenes(story: Story, generated: GeneratedStory): Scene[] {
    const scenes = generated.scenes.slice(0, story.settings.sceneCount);
    const durationSec = story.settings.durationSec / scenes.length;
    return scenes.map((s, index) => ({
      id: newId(),
      storyId: story.id,
      index,
      text: s.text,
      narration: s.narration,
      imagePrompt: s.imagePrompt,
      motion: (MOTION_TYPES as readonly string[]).includes(s.motion)
        ? (s.motion as MotionType)
        : MOTION_TYPES[index % MOTION_TYPES.length]!,
      durationSec,
      imagePath: null,
      audioPath: null,
      subtitlePath: null,
      videoPath: null,
    }));
  }
}
