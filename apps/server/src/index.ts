import { App } from "@ai-story/core";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { relative } from "node:path";
import { onError } from "./http";
import { catalogRoutes } from "./routes/catalog";
import { jobRoutes } from "./routes/jobs";
import { projectRoutes } from "./routes/projects";
import { providerConfigRoutes } from "./routes/providers";
import { sceneRoutes, storyRoutes } from "./routes/stories";

const app = new App();
app.jobs.start();

const server = new Hono()
  .use(logger())
  .use("/api/*", cors())
  .onError(onError)
  .route("/api", catalogRoutes(app))
  .route("/api/projects", projectRoutes(app))
  .route("/api/stories", storyRoutes(app))
  .route("/api/scenes", sceneRoutes(app))
  .route("/api/jobs", jobRoutes(app))
  .route("/api/provider-configs", providerConfigRoutes(app))
  // Generated assets: /files/<project>/<story>/{images,audios,videos}/...
  .use(
    "/files/*",
    serveStatic({ root: relative(process.cwd(), app.config.storageDir), rewriteRequestPath: (p) => p.replace(/^\/files/, "") }),
  )
  .get("/health", (c) => c.json({ ok: true }));

console.log(`AI Story API on http://localhost:${app.config.port}`);

export default { port: app.config.port, fetch: server.fetch, idleTimeout: 0 };
