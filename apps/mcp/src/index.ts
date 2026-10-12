#!/usr/bin/env bun
import {
  App,
  BatchSchema,
  CreateCategorySchema,
  CreateProjectSchema,
  CreateProviderSchema,
  CreateStorySchema,
  PartialSettingsSchema,
  RenderOptionsSchema,
  ScenePatchSchema,
  UpdateCategorySchema,
  UpdateProviderSchema,
} from "@ai-story/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * MCP server exposing the story generator to any MCP client
 * (Codex, Gemini CLI, Antigravity, omp, Claude...). Jobs run in-process.
 */
const app = new App();
app.jobs.start();

const server = new McpServer({ name: "ai-story", version: "0.1.0" });

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

/** Registers a tool: args are validated with the shared zod shape, the result is returned as JSON text. */
function tool<S extends z.ZodRawShape>(name: string, description: string, shape: S, run: (args: z.infer<z.ZodObject<S>>) => unknown) {
  const schema = z.object(shape);
  const handler = async (args: unknown) => {
    try {
      return json(await run(schema.parse(args)));
    } catch (error) {
      return { ...json({ error: (error as Error).message }), isError: true };
    }
  };
  // The SDK's generic callback type can't follow a generic shape; validation above keeps it safe.
  server.registerTool(name, { description, inputSchema: shape as z.ZodRawShape }, handler as never);
}

const StoryId = { storyId: z.string() };

tool("list_categories", "Story categories with counts and unique capacity", {}, () => app.stories.stats());
tool("get_category", "A category's seeds, style suggestions and prompt templates", { categoryId: z.string() }, (a) => app.categoryConfigs.get(a.categoryId));
tool("get_prompt_template_defaults", "Default story/image prompt templates and their {{placeholders}}", {}, () => app.categoryConfigs.templateDefaults());
tool("create_category", "Add a category (seeds, style suggestions, optional prompt templates)", CreateCategorySchema.shape, (a) => app.categoryConfigs.create(a));
tool("update_category", "Change a category's label, emoji, description, image style, seeds, style suggestions or prompt templates", { categoryId: z.string(), ...UpdateCategorySchema.shape }, ({ categoryId, ...patch }) =>
  app.categoryConfigs.update(categoryId, patch),
);
tool("list_providers", "Text/image/audio/video providers and availability", {}, () => app.providers.describe());
tool("list_provider_configs", "Stored provider configuration (secrets masked), with availability", {}, () => app.providerConfigs.list());
tool("list_provider_types", "Provider driver types and the config fields each one takes", {}, () => app.providerConfigs.drivers());
tool("create_provider", "Add a provider from a driver type with its config", CreateProviderSchema.shape, (a) => app.providerConfigs.create(a));
tool("update_provider", "Change a provider's label, enabled flag or config", { providerId: z.string(), ...UpdateProviderSchema.shape }, ({ providerId, ...patch }) =>
  app.providerConfigs.update(providerId, patch),
);
tool("list_voices", "Voice choices for an audio provider id (default provider when omitted): Edge/Gemini voice names or cloned voices", { audio: z.string().optional(), language: z.enum(["km", "en"]).optional() }, (a) =>
  app.voices.options(a.audio, a.language ?? "km"),
);
tool(
  "create_voice",
  'Add a voice to a Gradio audio provider (e.g. VoxCPM): mode "clone" from a local reference audio file (filePath), or mode "design" from a description in `style`',
  {
    providerId: z.string(),
    name: z.string(),
    mode: z.enum(["clone", "design"]).optional(),
    filePath: z.string().optional(),
    transcript: z.string().optional(),
    style: z.string().optional(),
  },
  async ({ providerId, filePath, ...input }) =>
    app.voices.create(providerId, input, filePath ? new File([Bun.file(filePath)], filePath.split("/").pop()!) : undefined),
);
tool("set_default_provider", "Make a provider the default for its kind", { providerId: z.string() }, (a) => app.providerConfigs.setDefault(a.providerId));
tool("list_projects", "List projects", {}, () => app.projects.list());
tool("create_project", "Create a project (stories are stored per project)", CreateProjectSchema.shape, (a) => app.projects.create(a));

tool("list_stories", "List stories, optionally filtered", { projectId: z.string().optional(), limit: z.number().optional() }, (a) =>
  app.stories.list(a),
);
tool("get_story", "Get a story with all scenes and asset paths", StoryId, (a) => app.stories.get(a.storyId));

tool(
  "generate_story",
  "Create a unique story and generate its script synchronously. Pass script (and optionally title) to split your own script into scenes instead. Set render=true to queue asset rendering afterwards.",
  CreateStorySchema.shape,
  async (a) => {
    const draft = app.stories.createDraft(a.projectId, a.category, a.settings, undefined, a.script ? { script: a.script, title: a.title } : undefined);
    const story = await app.stories.generateScript(draft.id);
    const job = a.render ? app.jobs.enqueue("render-assets", { storyId: story.id }) : undefined;
    return { story, job };
  },
);
tool("generate_batch", "Queue many unique stories for one category (background job)", BatchSchema.shape, (a) =>
  app.jobs.enqueue("generate-batch", a),
);
tool("update_story_settings", "Change durations, scene count, language, aspect ratio or providers", { ...StoryId, settings: PartialSettingsSchema }, (a) =>
  app.stories.updateSettings(a.storyId, a.settings),
);
tool("update_scene", "Edit a scene's text, narration, image prompt, motion or duration", { sceneId: z.string(), ...ScenePatchSchema.shape }, ({ sceneId, ...patch }) =>
  app.stories.updateScene(sceneId, patch),
);
tool("render_story", "Queue image/audio/video rendering for a scripted story", { ...StoryId, ...RenderOptionsSchema.shape }, (a) =>
  app.jobs.enqueue("render-assets", a),
);
tool("get_job", "Check a background job's progress", { jobId: z.string() }, (a) => app.jobs.get(a.jobId));

await server.connect(new StdioServerTransport());
