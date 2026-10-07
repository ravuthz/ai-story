import { DefaultVoiceSchema, LanguageSchema, PreviewVoiceSchema, VoiceSchema, type App } from "@ai-story/core";
import { body } from "../http";
import type { Context } from "hono";
import { Hono } from "hono";

/** Reads a voice form (multipart with an optional "file", or JSON): the text fields and the file. */
async function voiceForm(c: Context) {
  const isMultipart = c.req.header("content-type")?.includes("multipart/form-data");
  const raw: Record<string, unknown> = isMultipart ? await c.req.parseBody() : await c.req.json().catch(() => ({}));
  const file = raw.file instanceof File ? raw.file : undefined;
  return { fields: Object.fromEntries(["name", "mode", "transcript", "style"].filter((k) => typeof raw[k] === "string").map((k) => [k, raw[k]])), file };
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
    // The provider's default narration voice: a selected clone, or a voice description.
    .post("/provider/:providerId/default", async (c) => {
      const providerId = c.req.param("providerId");
      const defaultVoice = app.voices.checkDefault(providerId, await body(c, DefaultVoiceSchema));
      return c.json(app.providerConfigs.update(providerId, { config: { defaultVoice } }));
    })
    .post("/provider/:providerId/preview", async (c) => c.json(await app.voices.preview(c.req.param("providerId"), await body(c, PreviewVoiceSchema))))
    .patch("/:id", async (c) => {
      const { fields, file } = await voiceForm(c);
      return c.json(await app.voices.update(c.req.param("id"), VoiceSchema.partial().parse(fields), file));
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id");
      const { providerId } = app.voices.get(id);
      await app.voices.delete(id);
      // A provider whose selected clone was deleted falls back to the app's own default voice.
      const provider = (await app.providerConfigs.list()).find((p) => p.id === providerId);
      if ((provider?.config.defaultVoice as { voiceId?: string } | undefined)?.voiceId === id) {
        app.providerConfigs.update(providerId, { config: { defaultVoice: {} } });
      }
      return c.body(null, 204);
    });
