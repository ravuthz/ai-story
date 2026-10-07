import { CreateProjectSchema, type App } from "@ai-story/core";
import { Hono } from "hono";
import { body } from "../http";

export const projectRoutes = (app: App) =>
  new Hono()
    .get("/", (c) => c.json(app.projects.list()))
    .post("/", async (c) => c.json(app.projects.create(await body(c, CreateProjectSchema)), 201))
    .get("/:id", (c) => c.json(app.projects.get(c.req.param("id"))))
    .delete("/:id", async (c) => {
      await app.projects.delete(c.req.param("id"));
      return c.body(null, 204);
    });
