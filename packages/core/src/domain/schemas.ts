import { z } from "zod";
import { RENDER_STEPS } from "../services/RenderService";
import { CategoryIdSchema, MOTION_TYPES, PartialSettingsSchema } from "./types";

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

export const GenerateStoryJobSchema = z.object({ storyId: z.string(), render: z.boolean().optional() });
export const RenderJobSchema = RenderOptionsSchema.extend({ storyId: z.string() });
