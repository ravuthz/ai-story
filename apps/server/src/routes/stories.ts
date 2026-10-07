import {
  BatchSchema,
  CategoryIdSchema,
  CreateStorySchema,
  PartialSettingsSchema,
  RenderOptionsSchema,
  ScenePatchSchema,
  type App,
} from "@ai-story/core";
import { Hono } from "hono";
import { body } from "../http";

export const storyRoutes = (app: App) =>
  new Hono()
    .get("/", (c) => {
      const q = c.req.query();
      return c.json(
        app.stories.list({
          projectId: q.projectId,
          category: q.category ? CategoryIdSchema.parse(q.category) : undefined,
          status: q.status,
          limit: Number(q.limit) || 50,
          offset: Number(q.offset) || 0,
        }),
      );
    })
    .post("/", async (c) => {
      const input = await body(c, CreateStorySchema);
      const story = app.stories.createDraft(input.projectId, input.category, input.settings);
      const job = app.jobs.enqueue("generate-story", { storyId: story.id, render: input.render });
      return c.json({ story, job }, 202);
    })
    .post("/batch", async (c) => c.json({ job: app.jobs.enqueue("generate-batch", await body(c, BatchSchema)) }, 202))
    .get("/:id", (c) => c.json(app.stories.get(c.req.param("id"))))
    .patch("/:id/settings", async (c) => c.json(app.stories.updateSettings(c.req.param("id"), await body(c, PartialSettingsSchema))))
    .post("/:id/redistribute", (c) => c.json(app.stories.redistributeDurations(c.req.param("id"))))
    .post("/:id/generate", (c) => c.json({ job: app.jobs.enqueue("generate-story", { storyId: c.req.param("id") }) }, 202))
    .post("/:id/render", async (c) => {
      const options = await body(c, RenderOptionsSchema);
      return c.json({ job: app.jobs.enqueue("render-assets", { ...options, storyId: c.req.param("id") }) }, 202);
    })
    .delete("/:id", async (c) => {
      await app.stories.delete(c.req.param("id"));
      return c.body(null, 204);
    });

export const sceneRoutes = (app: App) =>
  new Hono().patch("/:id", async (c) => c.json(app.stories.updateScene(c.req.param("id"), await body(c, ScenePatchSchema))));
