import { CreateCategorySchema, UpdateCategorySchema, type App } from "@ai-story/core";
import { Hono } from "hono";
import { body } from "../http";

/** Database-backed categories: seeds, style suggestions and prompt templates; changes apply immediately. */
export const categoryRoutes = (app: App) => {
  // Each category with its story count and how many unique blueprints its seeds allow.
  const withStats = <T extends { id: string }>(c: T, counts = new Map(app.stories.stats().map((s) => [s.category, s.count]))) => ({
    ...c,
    count: counts.get(c.id) ?? 0,
    capacity: app.categories.get(c.id).capacity,
  });
  return new Hono()
    .get("/", (c) => {
      const counts = new Map(app.stories.stats().map((s) => [s.category, s.count]));
      return c.json(app.categoryConfigs.list().map((cat) => withStats(cat, counts)));
    })
    .get("/template-defaults", (c) => c.json(app.categoryConfigs.templateDefaults()))
    .get("/:id", (c) => c.json(withStats(app.categoryConfigs.get(c.req.param("id")))))
    .post("/", async (c) => c.json(withStats(app.categoryConfigs.create(await body(c, CreateCategorySchema))), 201))
    .patch("/:id", async (c) => c.json(withStats(app.categoryConfigs.update(c.req.param("id"), await body(c, UpdateCategorySchema)))))
    .delete("/:id", (c) => {
      app.categoryConfigs.delete(c.req.param("id"));
      return c.body(null, 204);
    });
};
