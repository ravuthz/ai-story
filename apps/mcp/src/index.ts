#!/usr/bin/env bun
import {
  App,
  BatchSchema,
  CATEGORY_IDS,
  CreateProjectSchema,
  CreateProviderSchema,
  CreateStorySchema,
  PartialSettingsSchema,
  RenderOptionsSchema,
  ScenePatchSchema,
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

tool("list_categories", `Story categories (${CATEGORY_IDS.join(", ")}) with counts and unique capacity`, {}, () =>
  app.stories.stats(),
);
tool("list_providers", "Text/image/audio/video providers and availability", {}, () => app.providers.describe());
tool("list_provider_configs", "Stored provider configuration (secrets masked), with availability", {}, () => app.providerConfigs.list());
tool("list_provider_types", "Provider driver types and the config fields each one takes", {}, () => app.providerConfigs.drivers());
tool("create_provider", "Add a provider from a driver type with its config", CreateProviderSchema.shape, (a) => app.providerConfigs.create(a));
tool("update_provider", "Change a provider's label, enabled flag or config", { providerId: z.string(), ...UpdateProviderSchema.shape }, ({ providerId, ...patch }) =>
  app.providerConfigs.update(providerId, patch),
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
  "Create a unique story and generate its script synchronously. Set render=true to queue asset rendering afterwards.",
  CreateStorySchema.shape,
  async (a) => {
    const draft = app.stories.createDraft(a.projectId, a.category, a.settings);
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
