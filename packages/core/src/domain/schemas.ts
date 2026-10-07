import { z } from "zod";
import { RENDER_STEPS } from "../services/RenderService";
import { CategoryIdSchema, LanguageSchema, MOTION_TYPES, PartialSettingsSchema, VOICE_MODES } from "./types";

/** Input schemas shared by the HTTP API, the MCP server and job payloads. */

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

export const RenderOptionsSchema = z.object({
  steps: z.array(z.enum(RENDER_STEPS)).optional(),
  force: z.boolean().optional(),
  sceneIds: z.array(z.string()).optional(),
  concurrency: z.number().int().min(1).max(8).optional(),
});

export const CreateStorySchema = z.object({
  projectId: z.string(),
  category: CategoryIdSchema,
  settings: PartialSettingsSchema.optional(),
  /** Also render images/audio/video after the script. */
  render: z.boolean().optional(),
});

export const BatchSchema = z.object({
  projectId: z.string(),
  category: CategoryIdSchema,
  count: z.number().int().min(1).max(5000),
  settings: PartialSettingsSchema.optional(),
  render: z.boolean().optional(),
});

export const ScenePatchSchema = z.object({
  text: z.string().optional(),
  narration: z.string().optional(),
  imagePrompt: z.string().optional(),
  motion: z.enum(MOTION_TYPES).optional(),
  durationSec: z.number().min(1).max(600).optional(),
});

const PoolSchema = z.array(z.string().max(300)).max(500);
const CategoryFieldsSchema = z.object({
  label: z.string().trim().min(1).max(80),
  emoji: z.string().max(16).optional(),
  description: z.string().max(1000).optional(),
  imageStyle: z.string().max(1000).optional(),
  pools: z.object({ themes: PoolSchema, settings: PoolSchema, protagonists: PoolSchema, twists: PoolSchema, tones: PoolSchema }),
  styleSuggestions: z.array(z.string().max(80)).max(100).optional(),
  storyPrompt: z.string().max(20000).optional(),
  imagePrompt: z.string().max(4000).optional(),
});
export const CreateCategorySchema = CategoryFieldsSchema.extend({ id: CategoryIdSchema });
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
/** The id is fixed after creation (stories refer to it). */
export const UpdateCategorySchema = CategoryFieldsSchema.partial().extend({
  storyPrompt: z.string().trim().min(1).max(20000).optional(),
  imagePrompt: z.string().trim().min(1).max(4000).optional(),
});
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

export const GenerateStoryJobSchema = z.object({ storyId: z.string(), render: z.boolean().optional() });
export const RenderJobSchema = RenderOptionsSchema.extend({ storyId: z.string() });

export const CreateProviderSchema = z.object({
  /** Driver type, e.g. "qwen-gradio" (see GET /api/provider-configs/drivers). */
  type: z.string(),
  /** Id stories use to pick this provider; unique per kind and fixed after creation. */
  slug: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,59}$/, "lowercase letters, digits, . _ - (max 60)"),
  label: z.string().max(120).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type CreateProviderInput = z.infer<typeof CreateProviderSchema>;

export const UpdateProviderSchema = z.object({
  label: z.string().max(120).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateProviderInput = z.infer<typeof UpdateProviderSchema>;

export const VoiceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** "clone" (reference clip) or "design" (described in `style`); defaults to clone. */
  mode: z.enum(VOICE_MODES).optional(),
  transcript: z.string().max(2000).optional(),
  style: z.string().max(500).optional(),
});
export type VoiceInput = z.infer<typeof VoiceSchema>;

/** A provider's default narration voice: a selected cloned voice, or a designed one described in words. */
export const DefaultVoiceSchema = z.object({
  mode: z.enum(VOICE_MODES),
  voiceId: z.string().optional(),
  description: z.string().max(1000).optional(),
});
export type DefaultVoice = z.infer<typeof DefaultVoiceSchema>;

/** "Try it": speak a short text with a voice choice before saving it. */
export const PreviewVoiceSchema = DefaultVoiceSchema.extend({
  text: z.string().trim().min(1).max(500),
  language: LanguageSchema.optional(),
});
