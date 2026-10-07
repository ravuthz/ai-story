import { z } from "zod";

export const CATEGORY_IDS = [
  "horror-story",
  "love-story",
  "motivation",
  "philosophy",
  "quotes",
  "folklore",
  "kid-story",
] as const;

export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export type CategoryId = z.infer<typeof CategoryIdSchema>;

export const LanguageSchema = z.enum(["km", "en"]);
export type Language = z.infer<typeof LanguageSchema>;

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const ProviderKindSchema = z.enum(["text", "image", "audio", "video"]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

const ProvidersSchema = z.object({
  text: z.string().optional(),
  image: z.string().optional(),
  audio: z.string().optional(),
  video: z.string().optional(),
});

/** Per-story configuration fields, without defaults (safe for partial updates). */
const SettingsFieldsSchema = z.object({
  sceneCount: z.number().int().min(1).max(60),
  /** Target total duration in seconds; split evenly across scenes unless a scene overrides it. */
  durationSec: z.number().int().min(5).max(3600),
  narrationLanguage: LanguageSchema,
  aspectRatio: AspectRatioSchema,
  imageStyle: z.string(),
  providers: ProvidersSchema,
  voice: z.string().optional(),
});
export type StorySettings = z.infer<typeof SettingsFieldsSchema>;

export const SETTINGS_DEFAULTS: StorySettings = {
  sceneCount: 6,
  durationSec: 60,
  narrationLanguage: "km",
  aspectRatio: "9:16",
  imageStyle: "cinematic, highly detailed, dramatic lighting",
  providers: {},
};

/** Partial settings as sent by clients: no defaults are injected. */
export const PartialSettingsSchema = SettingsFieldsSchema.partial();

/** Full settings: any missing field falls back to SETTINGS_DEFAULTS. */
export const StorySettingsSchema = PartialSettingsSchema.transform(
  (input): StorySettings => ({
    ...SETTINGS_DEFAULTS,
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
  }),
);

/** The unique combination of seeds a story is generated from. */
export interface StoryBlueprint {
  category: CategoryId;
  theme: string;
  setting: string;
  protagonist: string;
  twist: string;
  tone: string;
  fingerprint: string;
}

export type StoryStatus = "draft" | "generating" | "scripted" | "rendering" | "done" | "failed";

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface Story {
  id: string;
  projectId: string;
  category: CategoryId;
  title: string;
  slug: string;
  synopsis: string;
  moral: string;
  status: StoryStatus;
  blueprint: StoryBlueprint;
  settings: StorySettings;
  /** Final rendered video, relative to the storage root. */
  videoPath: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  storyId: string;
  index: number;
  /** English story text. */
  text: string;
  /** Narration in the story's narration language (Khmer by default). */
  narration: string;
  imagePrompt: string;
  motion: MotionType;
  durationSec: number;
  imagePath: string | null;
  audioPath: string | null;
  videoPath: string | null;
}

export const MOTION_TYPES = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"] as const;
export type MotionType = (typeof MOTION_TYPES)[number];

export type JobType = "generate-story" | "generate-batch" | "render-assets";
export type JobStatus = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  progress: number;
  message: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
