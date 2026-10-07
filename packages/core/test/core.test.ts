import { describe, expect, test } from "bun:test";
import { App } from "../src/App";
import { config } from "../src/config";
import { ProviderRepository } from "../src/db/repositories/ProviderRepository";
import { SECRET_MASK } from "../src/services/ProviderService";
import { CATEGORY_IDS } from "../src/domain/types";
import { renderArgs } from "../src/providers/mcp/McpProviders";
import { extractJson } from "../src/utils/text";

const app = new App({ ...config, databasePath: ":memory:", storageDir: "/tmp/ai-story-test" });

describe("categories", () => {
  test("each category supports more than 1000 unique blueprints", () => {
    for (const id of CATEGORY_IDS) expect(app.categories.get(id).capacity).toBeGreaterThan(1000);
  });
});

describe("unique blueprints", () => {
  test("1500 drafts in one category never repeat a fingerprint", () => {
    const project = app.projects.create({ name: "Uniqueness" });
    const fingerprints = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      fingerprints.add(app.stories.createDraft(project.id, "horror-story").blueprint.fingerprint);
    }
    expect(fingerprints.size).toBe(1500);
    expect(app.stories.list({ projectId: project.id }).total).toBe(1500);
  });

  test("settings are validated with defaults", () => {
    const project = app.projects.create({ name: "Settings" });
    const story = app.stories.createDraft(project.id, "kid-story", { sceneCount: 3, durationSec: 30 });
    expect(story.settings).toMatchObject({ sceneCount: 3, durationSec: 30, narrationLanguage: "km", aspectRatio: "9:16" });
  });
});

describe("utils", () => {
  test("extractJson handles fences and chatter", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('noise {"b":{"c":2}} trailing')).toEqual({ b: { c: 2 } });
  });

  test("renderArgs keeps types for whole placeholders", () => {
    expect(renderArgs({ d: "{{n}}", p: "a {{s}}" }, { n: 5, s: "cat" })).toEqual({ d: 5, p: "a cat" });
  });
});

describe("settings updates", () => {
  test("partial update keeps existing values", () => {
    const project = app.projects.create({ name: "Patch" });
    const story = app.stories.createDraft(project.id, "quotes", { sceneCount: 3, durationSec: 15 });
    const updated = app.stories.updateSettings(story.id, { providers: { text: "gemini" } });
    expect(updated.settings).toMatchObject({ sceneCount: 3, durationSec: 15, providers: { text: "gemini" } });
  });
});

describe("provider configuration", () => {
  test("legacy providers are imported once with defaults from config", async () => {
    const records = await app.providerConfigs.list();
    expect(records.map((r) => `${r.kind}:${r.slug}`)).toEqual(
      expect.arrayContaining(["text:codex", "text:claude", "image:qwen", "image:gemini", "audio:edge", "video:ffmpeg", "video:gradio"]),
    );
    for (const kind of ["text", "image", "audio", "video"] as const) {
      expect(records.filter((r) => r.kind === kind && r.isDefault).map((r) => r.slug)).toEqual([config.defaults[kind]]);
      expect(app.providers.defaults[kind]).toBe(config.defaults[kind]);
    }
  });

  test("create, mask secrets, update, default and delete apply to the live registry", () => {
    const created = app.providerConfigs.create({ type: "gemini-tts", slug: "gemini-pro", label: "Gemini Pro TTS", config: { apiKey: "k1" } });
    expect(created.config.apiKey).toBe(SECRET_MASK);
    expect(app.providers.get("audio", "gemini-pro").label).toBe("Gemini Pro TTS");

    // Sending the mask back keeps the stored key.
    app.providerConfigs.update(created.id, { config: { apiKey: SECRET_MASK, model: "m2" } });
    const db = new ProviderRepository(app.db).getById(created.id);
    expect(db.config).toMatchObject({ apiKey: "k1", model: "m2" });

    app.providerConfigs.setDefault(created.id);
    expect(app.providers.get("audio").id).toBe("gemini-pro");
    expect(() => app.providerConfigs.delete(created.id)).toThrow(/default/);
    expect(() => app.providerConfigs.update(created.id, { enabled: false })).toThrow(/default/);

    const edge = new ProviderRepository(app.db).findBySlug("audio", "edge")!;
    app.providerConfigs.setDefault(edge.id);
    app.providerConfigs.update(created.id, { enabled: false });
    expect(() => app.providers.get("audio", "gemini-pro")).toThrow(/No enabled audio provider/);
    app.providerConfigs.delete(created.id);
    expect(app.providers.ids("audio")).not.toContain("gemini-pro");
  });

  test("rejects duplicate slugs and unknown types", () => {
    expect(() => app.providerConfigs.create({ type: "edge-tts", slug: "edge" })).toThrow(/already exists/);
    expect(() => app.providerConfigs.create({ type: "nope", slug: "x" })).toThrow(/Unknown provider type/);
  });
});

describe("gradio providers", () => {
  test("preset image and TTS spaces are added in the generic format", async () => {
    const records = await app.providerConfigs.list();
    const slugs = records.map((r) => `${r.kind}:${r.slug}:${r.type}`);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "image:qwen:gradio-image",
        "image:qwen-image-2-1:gradio-image",
        "image:qwen-image-2-1-enhance:gradio-image",
        "image:qwen-image-2-1-uncensored:gradio-image",
        "image:qwen-image-2-1-viggle:gradio-image",
        "audio:voxcpm:gradio-audio",
        "audio:voxcpm2-appkh:gradio-audio",
        "audio:voxcpm-appkh:gradio-audio",
        "video:gradio:gradio-video",
      ]),
    );
    const vox = records.find((r) => r.slug === "voxcpm")!;
    expect(vox.config).toMatchObject({ space: "openbmb/VoxCPM-Demo", apiName: "/generate", params: { text_input: "{{text}}", reference_wav_path_input: null } });
  });

  test("legacy rows convert to the generic format", async () => {
    const { upgradeLegacyGradio } = await import("../src/providers/seed");
    expect(upgradeLegacyGradio({ type: "qwen-gradio", config: { url: "Qwen/Qwen-Image", endpoint: "/infer", hfToken: "t" } })).toEqual({
      type: "gradio-image",
      config: { space: "Qwen/Qwen-Image", apiName: "/infer", hfToken: "t", params: { prompt: "{{prompt}}", aspect_ratio: "{{aspectRatio}}", randomize_seed: true } },
    });
    expect(upgradeLegacyGradio({ type: "gradio-video", config: { space: "x", apiName: "/a", params: {} } })).toBeNull();
  });
});
