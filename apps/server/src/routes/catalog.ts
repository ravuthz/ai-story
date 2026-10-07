import type { App } from "@ai-story/core";
import { Hono } from "hono";

export const catalogRoutes = (app: App) =>
  new Hono()
    .get("/providers", async (c) => c.json({ defaults: app.providers.defaults, providers: await app.providers.describe() }));
