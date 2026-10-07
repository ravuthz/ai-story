import { EdgeTtsProvider, type App } from "@ai-story/core";
import { Hono } from "hono";

export const catalogRoutes = (app: App) =>
  new Hono()
    .get("/categories", (c) => {
      const stats = new Map(app.stories.stats().map((s) => [s.category, s.count]));
      return c.json(app.categories.list().map((cat) => ({ ...cat.toJSON(), count: stats.get(cat.id) ?? 0 })));
    })
    .get("/providers", async (c) => c.json({ defaults: app.config.defaults, providers: await app.providers.describe() }))
    .get("/voices", (c) => c.json(EdgeTtsProvider.VOICES));
