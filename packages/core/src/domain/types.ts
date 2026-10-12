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

/** Category ids are stored in the database (CATEGORY_IDS are the built-in ones); existence is checked by the registry. */
export const CategoryIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "lowercase letters, digits and - (max 40)");
export type CategoryId = string;

export const LanguageSchema = z.enum(["km", "en"]);
export type Language = z.infer<typeof LanguageSchema>;

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

/** Burned-in subtitle looks; "none" renders clips without subtitles. */
export const SUBTITLE_STYLES = ["none", "classic", "boxed", "yellow", "bold", "minimal"] as const;
export const SubtitleStyleSchema = z.enum(SUBTITLE_STYLES);
export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;

export const ProviderKindSchema = z.enum(["text", "image", "audio", "video"]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;
export const PROVIDER_KINDS = ProviderKindSchema.options;

const ProvidersSchema = z.object({
  text: z.string().optional(),
  image: z.string().optional(),
  audio: z.string().optional(),
  video: z.string().optional(),
});

/** Per-story configuration fields, without defaults (safe for partial updates). */
export const VOICE_MODES = ["clone", "design"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

const SettingsFieldsSchema = z.object({
  sceneCount: z.number().int().min(1).max(60),
  /** Target total duration in seconds; split evenly across scenes unless a scene overrides it. */
  durationSec: z.number().int().min(5).max(3600),
  narrationLanguage: LanguageSchema,
  aspectRatio: AspectRatioSchema,
  imageStyle: z.string(),
  /** Subtitles burned into clips when they render; missing = "none". */
  subtitleStyle: SubtitleStyleSchema.optional(),
  providers: ProvidersSchema,
  voice: z.string().optional(),
  /** For providers with custom voices: narrate with a cloned or a designed voice; `voice` must be of this kind. */
  voiceMode: z.enum(VOICE_MODES).optional(),
  /** Voice design for this story (voiceMode "design"); blank = the provider's own voice description. */
  voiceDescription: z.string().max(1000).optional(),
  /** When clips render: a scene longer than its narration ends with the narration (cut, or sped up with speedUpVideo). */
  fitAudio: z.boolean().optional(),
  speedUpVideo: z.boolean().optional(),
  /** When clips render: narration longer than its scene ends with the scene (cut, or sped up ≤2× with speedUpAudio). */
  fitVideo: z.boolean().optional(),
  speedUpAudio: z.boolean().optional(),
  /** When clips render: each scene gets a random camera motion (saved back to the scene) instead of its own. */
  randomMotion: z.boolean().optional(),
});
export type StorySettings = z.infer<typeof SettingsFieldsSchema>;

export const SETTINGS_DEFAULTS: StorySettings = {
  sceneCount: 6,
  durationSec: 60,
  narrationLanguage: "km",
  aspectRatio: "9:16",
  imageStyle: "Cinematic Realistic",
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
  /** The user's own script ("Create story"); scripts are then split from it instead of written by the AI. */
  script: string | null;
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
  /** Subtitle cues (JSON) timed to the narration audio. */
  subtitlePath: string | null;
  videoPath: string | null;
}

export const MOTION_TYPES = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "pan-up-left",
  "pan-up-right",
  "pan-down-left",
  "pan-down-right",
  "zoom-in-left",
  "zoom-in-right",
] as const;
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

/** A configured provider instance, stored in the `providers` table. */
export interface ProviderRecord {
  id: string;
  kind: ProviderKind;
  /** Id used by story settings (`settings.providers[kind]`); unique per kind and immutable. */
  slug: string;
  /** Driver that builds the provider (see providers/drivers.ts). */
  type: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * A voice owned by an audio provider: either a clone of a reference clip (plus optional transcript / style),
 * or a designed voice described in words (`style`), with no clip.
 */
export interface Voice {
  id: string;
  providerId: string;
  name: string;
  mode: VoiceMode;
  /** Reference audio relative to the storage root; null for designed voices. */
  filePath: string | null;
  /** What is said in the reference clip; improves cloning when the app supports it. */
  transcript: string;
  /** Control instruction: the voice description for a designed voice, an optional style for a clone. */
  style: string;
  createdAt: string;
  updatedAt: string;
}
