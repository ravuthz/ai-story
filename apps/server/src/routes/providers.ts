import { CreateProviderSchema, UpdateProviderSchema, type App } from "@ai-story/core";
import { Hono } from "hono";
import { body } from "../http";

/** CRUD for database-backed provider configuration; changes apply to the running server immediately. */
export const providerConfigRoutes = (app: App) =>
  new Hono()
    .get("/", async (c) => c.json(await app.providerConfigs.list()))
    .get("/drivers", (c) => c.json(app.providerConfigs.drivers()))
    .post("/", async (c) => c.json(app.providerConfigs.create(await body(c, CreateProviderSchema)), 201))
    .patch("/:id", async (c) => c.json(app.providerConfigs.update(c.req.param("id"), await body(c, UpdateProviderSchema))))
    .post("/:id/default", (c) => c.json(app.providerConfigs.setDefault(c.req.param("id"))))
    .delete("/:id", (c) => {
      app.providerConfigs.delete(c.req.param("id"));
      return c.body(null, 204);
    });
