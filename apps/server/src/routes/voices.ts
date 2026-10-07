import { LanguageSchema, VoiceSchema, type App } from "@ai-story/core";
import type { Context } from "hono";
import { Hono } from "hono";

/** Reads a voice form (multipart with an optional "file", or JSON): the text fields and the file. */
async function voiceForm(c: Context) {
  const isMultipart = c.req.header("content-type")?.includes("multipart/form-data");
  const raw: Record<string, unknown> = isMultipart ? await c.req.parseBody() : await c.req.json().catch(() => ({}));
  const file = raw.file instanceof File ? raw.file : undefined;
  return { fields: Object.fromEntries(["name", "transcript", "style"].filter((k) => typeof raw[k] === "string").map((k) => [k, raw[k]])), file };
}

export const voiceRoutes = (app: App) =>
  new Hono()
    // Voice choices for story settings, for the given audio provider id (default provider when omitted).
    .get("/", (c) => c.json(app.voices.options(c.req.query("audio"), LanguageSchema.catch("km").parse(c.req.query("language")))))
    .get("/provider/:providerId", (c) => c.json(app.voices.list(c.req.param("providerId"))))
    .post("/provider/:providerId", async (c) => {
      const { fields, file } = await voiceForm(c);
      return c.json(await app.voices.create(c.req.param("providerId"), VoiceSchema.parse(fields), file), 201);
    })
    .patch("/:id", async (c) => {
      const { fields, file } = await voiceForm(c);
      return c.json(await app.voices.update(c.req.param("id"), VoiceSchema.partial().parse(fields), file));
    })
    .delete("/:id", async (c) => {
      await app.voices.delete(c.req.param("id"));
      return c.body(null, 204);
    });
