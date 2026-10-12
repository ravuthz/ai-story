import { describe, expect, test } from "bun:test";
import { App } from "../src/App";
import { config } from "../src/config";
import { ProviderRepository } from "../src/db/repositories/ProviderRepository";
import { SECRET_MASK } from "../src/services/ProviderService";
import { CATEGORY_IDS } from "../src/domain/types";
import { renderArgs } from "../src/providers/mcp/McpProviders";
import { extractJson } from "../src/utils/text";
import { StoryPromptBuilder } from "../src/prompts/StoryPromptBuilder";

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
    const withVoice = app.stories.createDraft(project.id, "kid-story", { voiceMode: "design", voice: "v1" });
    expect(withVoice.settings).toMatchObject({ voiceMode: "design", voice: "v1" });
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
  test("preset providers hold their spaces as ordered connections", async () => {
    const records = await app.providerConfigs.list();
    const qwen = records.find((r) => r.kind === "image" && r.slug === "qwen-image-2-1")!;
    const conns = qwen.config.connections as { space: string; enabled: boolean }[];
    expect(conns.map((c) => c.space)).toEqual([
      "hugging-apps/qwen-image-2-1",
      "Qwen/Qwen-Image-2.1",
      "arudradey/qwen-image-2.1-uncensored-gguf",
      "Viggle/Qwen-Image-2.1-viggle-turbo",
    ]);
    expect(conns.map((c) => c.enabled)).toEqual([true, false, true, true]);
    const vox = records.find((r) => r.kind === "audio" && r.slug === "voxcpm")!;
    expect((vox.config.connections as { space: string }[]).map((c) => c.space)).toEqual([
      "openbmb/VoxCPM-Demo",
      "https://gradio-voxcpm2.appkh.online",
      "https://gradio-voxcmp.appkh.online/",
    ]);
    expect(records.some((r) => r.slug === "voxcpm-appkh" || r.slug === "qwen-image-2-1-viggle")).toBe(false);
    expect(records.find((r) => r.slug === "qwen")!.config.connections).toHaveLength(1);
  });

  test("falls through every connection in order and reports each failure", async () => {
    const created = app.providerConfigs.create({
      type: "gradio-image",
      slug: "fallback-test",
      config: {
        timeoutSec: 10,
        connections: [
          { space: "http://127.0.0.1:9/a", apiName: "/x", params: '{ "prompt": "{{prompt}}" }' },
          { space: "http://127.0.0.1:9/skipped", apiName: "/x", params: {}, enabled: false },
          { space: "http://127.0.0.1:9/b", apiName: "/x", params: {} },
        ],
      },
    });
    const error = await app.providers
      .get("image", "fallback-test")
      .generate({ prompt: "p", aspectRatio: "1:1", outPath: "/tmp/ai-story-test/x.png" })
      .catch((e: Error) => e);
    expect((error as Error).message).toMatch(/All Gradio connections failed:\n.*127\.0\.0\.1:9\/a.*\n.*127\.0\.0\.1:9\/b/s);
    expect((error as Error).message).not.toContain("skipped");
    app.providerConfigs.delete(created.id);
  });

  test("HF token only goes to Hugging Face hosts", async () => {
    const { GradioApi } = await import("../src/providers/GradioApi");
    expect(GradioApi.isHuggingFace("owner/space")).toBe(true);
    expect(GradioApi.isHuggingFace("https://owner-space.hf.space")).toBe(true);
    expect(GradioApi.isHuggingFace("https://gradio-voxcpm2.appkh.online")).toBe(false);
    expect(GradioApi.isHuggingFace("http://127.0.0.1:7860")).toBe(false);
  });

  test("legacy rows convert to the connections format", async () => {
    const { upgradeLegacyGradio, toConnectionsConfig } = await import("../src/providers/seed");
    expect(upgradeLegacyGradio({ type: "qwen-gradio", config: { url: "Qwen/Qwen-Image", endpoint: "/infer", hfToken: "t" } })).toEqual({
      type: "gradio-image",
      config: { hfToken: "t", connections: [{ space: "Qwen/Qwen-Image", apiName: "/infer", params: { prompt: "{{prompt}}", aspect_ratio: "{{aspectRatio}}", randomize_seed: true } }] },
    });
    expect(toConnectionsConfig({ space: "s", apiName: "/a", params: {}, hfToken: "t" })).toMatchObject({ hfToken: "t", connections: [{ space: "s", apiName: "/a" }] });
    expect(toConnectionsConfig({ connections: [] })).toBeNull();
    expect(toConnectionsConfig({ space: "", apiName: "/generate_video", params: {} })).toMatchObject({ connections: [] });
  });
});

describe("cloned voices", () => {
  const wav = (name = "ref.wav") => new File([new Uint8Array(64).fill(1)], name, { type: "audio/wav" });

  test("create, list, resolve, update, choose and delete voices", async () => {
    const vox = new ProviderRepository(app.db).findBySlug("audio", "voxcpm")!;
    const voice = await app.voices.create(vox.id, { name: "Grandma", transcript: "Once upon a time", style: "warm" }, wav());
    expect(voice.filePath).toMatch(/^_voices\/.+\.wav$/);
    expect(await Bun.file(app.storage.toAbsolute(voice.filePath!)).exists()).toBe(true);
    expect(app.voices.list(vox.id).map((v) => v.name)).toContain("Grandma");
    expect(app.voices.resolve(voice.id)).toMatchObject({ name: "Grandma", transcript: "Once upon a time", style: "warm" });

    // Voice choices follow the selected audio provider.
    expect(app.voices.options("voxcpm", "km")).toMatchObject({ cloning: true, voices: [{ value: voice.id, label: "Grandma", mode: "clone" }] });
    expect(app.voices.options("edge", "km").voices.map((v) => v.value)).toContain("km-KH-SreymomNeural");

    const oldPath = app.storage.toAbsolute(voice.filePath!);
    const updated = await app.voices.update(voice.id, { name: "Nana" }, wav("ref.mp3"));
    expect(updated).toMatchObject({ name: "Nana", transcript: "Once upon a time" });
    expect(await Bun.file(oldPath).exists()).toBe(false);

    await app.voices.delete(voice.id);
    expect(await Bun.file(app.storage.toAbsolute(updated.filePath!)).exists()).toBe(false);
    expect(app.voices.resolve(voice.id)).toBeNull();
  });

  test("rejects voices for providers that cannot clone, and bad files", async () => {
    const edge = new ProviderRepository(app.db).findBySlug("audio", "edge")!;
    const vox = new ProviderRepository(app.db).findBySlug("audio", "voxcpm")!;
    await expect(app.voices.create(edge.id, { name: "x" }, wav())).rejects.toThrow(/does not support/);
    await expect(app.voices.create(vox.id, { name: "x" }, undefined)).rejects.toThrow(/required/);
    await expect(app.voices.create(vox.id, { name: "x", mode: "design" }, undefined)).rejects.toThrow(/Describe the voice/);
    await expect(app.voices.create(vox.id, { name: "x" }, wav("notes.txt"))).rejects.toThrow(/Unsupported audio/);
  });

  test("designed voices need only a description and send no clip", async () => {
    const vox = new ProviderRepository(app.db).findBySlug("audio", "voxcpm")!;
    const designed = await app.voices.create(vox.id, { name: "Old monk", mode: "design", style: "an elderly man, deep calm voice", transcript: "ignored" }, undefined);
    expect(designed).toMatchObject({ mode: "design", filePath: null });
    expect(app.voices.resolve(designed.id)).toEqual({ name: "Old monk", mode: "design", filePath: null, transcript: "", style: "an elderly man, deep calm voice" });
    expect(app.voices.options("voxcpm", "km").voices).toContainEqual({ value: designed.id, label: "Old monk", mode: "design" });

    // A story set to cloned narration refuses a designed voice (checked before any network call).
    const narrate = (voiceMode: "clone" | "design") =>
      app.providers.get("audio", "voxcpm").synthesize({ text: "hi", language: "en", voice: designed.id, voiceMode, outPath: "/tmp/ai-story-test/v.mp3" });
    await expect(narrate("clone")).rejects.toThrow(/"Old monk" is a designed voice, but the story is set to use a cloned voice/);

    // design → clone needs a clip; clone → design drops it.
    await expect(app.voices.update(designed.id, { mode: "clone" })).rejects.toThrow(/reference audio/);
    const cloned = await app.voices.update(designed.id, { mode: "clone" }, wav());
    expect(cloned.filePath).toMatch(/^_voices\//);
    const back = await app.voices.update(designed.id, { mode: "design" });
    expect(back.filePath).toBeNull();
    expect(await Bun.file(app.storage.toAbsolute(cloned.filePath!)).exists()).toBe(false);
    await app.voices.delete(designed.id);
  });

  test("a provider's default voice is a selected clone or a required description", async () => {
    const vox = new ProviderRepository(app.db).findBySlug("audio", "voxcpm")!;
    const clone = await app.voices.create(vox.id, { name: "Narrator" }, wav());
    const designed = await app.voices.create(vox.id, { name: "Old design", mode: "design", style: "deep voice" }, undefined);

    expect(() => app.voices.checkDefault(vox.id, { mode: "design", description: "  " })).toThrow(/voice description/);
    expect(() => app.voices.checkDefault(vox.id, { mode: "clone" })).toThrow(/Select one of this provider's cloned voices/);
    expect(() => app.voices.checkDefault(vox.id, { mode: "clone", voiceId: designed.id })).toThrow(/cloned voices/);

    const pick = app.voices.checkDefault(vox.id, { mode: "clone", voiceId: clone.id, description: "ignored" });
    expect(pick).toEqual({ mode: "clone", voiceId: clone.id, description: undefined });
    app.providerConfigs.update(vox.id, { config: { defaultVoice: pick } });
    expect(app.voices.options("voxcpm", "km").defaultVoice).toMatchObject({ mode: "clone", voiceId: clone.id, voiceName: "Narrator" });
    // Other config is untouched by saving the default voice.
    expect((new ProviderRepository(app.db).getById(vox.id).config.connections as unknown[]).length).toBe(3);

    // A story asking for a designed voice with no description anywhere is refused before any network call.
    await expect(
      app.providers.get("audio", "voxcpm").synthesize({ text: "hi", language: "en", voiceMode: "design", outPath: "/tmp/ai-story-test/d.mp3" }),
    ).rejects.toThrow(/needs a voice description/);

    app.providerConfigs.update(vox.id, { config: { defaultVoice: {} } });
    await app.voices.delete(clone.id);
    await app.voices.delete(designed.id);
  });

  test("deleting a provider removes its voices and files", async () => {
    const created = app.providerConfigs.create({ type: "gradio-audio", slug: "tts-temp", config: { connections: [{ space: "a/b", apiName: "/x", params: {} }] } });
    const voice = await app.voices.create(created.id, { name: "Temp" }, wav());
    app.providerConfigs.delete(created.id);
    await Bun.sleep(20);
    expect(app.voices.resolve(voice.id)).toBeNull();
    expect(await Bun.file(app.storage.toAbsolute(voice.filePath!)).exists()).toBe(false);
  });
});

describe("categories in the database", () => {
  const pools = { themes: ["a lost key"], settings: ["a lighthouse"], protagonists: ["a keeper"], twists: ["it was a dream"], tones: ["calm", "eerie"] };

  test("built-ins are imported with emoji, style suggestions and default templates", () => {
    const horror = app.categoryConfigs.get("horror-story");
    expect(horror).toMatchObject({ emoji: "👻", builtIn: true });
    expect(horror.styleSuggestions).toEqual(expect.arrayContaining(["moody fog", "cinematic"]));
    expect(horror.storyPrompt).toContain("{{theme}}");
  });

  test("create a category, generate with its templates, edit and delete", async () => {
    const created = app.categoryConfigs.create({
      id: "sci-fi",
      label: "Sci-Fi",
      emoji: "🚀",
      pools: { ...pools, themes: ["a lost key", " a lost key ", ""] },
      styleSuggestions: ["neon", "neon", "retro future"],
      storyPrompt: "Write sci-fi about {{theme}} in {{setting}} with {{protagonist}}; twist {{twist}}; tone {{tone}}; {{sceneCount}} scenes.",
      imagePrompt: "{{scenePrompt}} | {{categoryStyle}} | {{style}}",
    });
    // Lists are trimmed and de-duplicated.
    expect(created.pools.themes).toEqual(["a lost key"]);
    expect(created.styleSuggestions).toEqual(["neon", "retro future"]);
    expect(app.categories.get("sci-fi").capacity).toBe(2);

    const project = app.projects.create({ name: "Sci-fi project" });
    const story = app.stories.createDraft(project.id, "sci-fi", { sceneCount: 3 });
    const prompt = new StoryPromptBuilder().build(app.categories.get("sci-fi"), story.blueprint, story.settings);
    expect(prompt).toStartWith("Write sci-fi about a lost key in a lighthouse with a keeper; twist it was a dream;");
    expect(prompt).toContain("3 scenes.");
    expect(prompt).toContain('Respond with ONLY a JSON object'); // contract always appended

    const updated = app.categoryConfigs.update("sci-fi", { imageStyle: "chrome and neon", imagePrompt: "{{scenePrompt}} in {{categoryStyle}}" });
    expect(new StoryPromptBuilder().imagePrompt("a ship", "x", app.categories.get("sci-fi"))).toBe("a ship in chrome and neon");
    expect(updated.label).toBe("Sci-Fi");

    expect(() => app.categoryConfigs.delete("sci-fi")).toThrow(/has 1 stories/);
    await app.stories.delete(story.id);
    app.categoryConfigs.delete("sci-fi");
    expect(() => app.categories.get("sci-fi")).toThrow(/Unknown category/);
  });

  test("templates must keep what generation depends on", () => {
    expect(() => app.categoryConfigs.update("quotes", { storyPrompt: "Write a quote about {{theme}}" })).toThrow(/missing \{\{setting\}\}, \{\{protagonist\}\}, \{\{twist\}\}, \{\{tone\}\}/);
    expect(() => app.categoryConfigs.update("quotes", { imagePrompt: "a pretty picture" })).toThrow(/\{\{scenePrompt\}\}/);
    expect(() => app.categoryConfigs.update("quotes", { pools: { ...pools, tones: [" "] } })).toThrow(/at least one tone/);
    expect(() => app.categoryConfigs.create({ id: "quotes", label: "Dup", pools })).toThrow(/already exists/);
  });
});

describe("custom story", () => {
  test("a user's script is stored and split into scenes, also on regenerate", async () => {
    const project = app.projects.create({ name: "Custom story" });
    const script = "A small fox found a lantern in the snow. It carried the light home and shared it with every animal in the forest.";
    const story = app.stories.createDraft(project.id, "kid-story", { sceneCount: 2, durationSec: 20, narrationLanguage: "en" }, undefined, { script, title: "The Fox Lantern" });
    expect(story).toMatchObject({ script, title: "The Fox Lantern" });
    const prompts: string[] = [];
    const providers = (app.stories as unknown as { providers: { get: unknown } }).providers;
    const original = providers.get;
    providers.get = () => ({
      complete: async (req: { prompt: string }) => {
        prompts.push(req.prompt);
        const scene = (text: string) => ({ text, narration: text, imagePrompt: "a fox in snow", motion: "zoom-in" });
        return JSON.stringify({ title: "Ignored", synopsis: "s", moral: "", scenes: [scene("A small fox found a lantern in the snow."), scene("It carried the light home.")] });
      },
    });
    try {
      const result = await app.stories.generateScript(story.id);
      expect(prompts[0]).toContain(script);
      expect(prompts[0]).toContain("exactly 2 consecutive scenes");
      expect(result.title).toBe("The Fox Lantern");
      expect(result.status).toBe("scripted");
      expect(result.scenes.map((s) => s.narration)).toEqual(["A small fox found a lantern in the snow.", "It carried the light home."]);
      await app.stories.generateScript(story.id);
      expect(prompts[1]).toContain(script);
    } finally {
      providers.get = original;
    }
  });

  test("without a title, the title comes from the script", async () => {
    const project = app.projects.create({ name: "Untitled" });
    const story = app.stories.createDraft(project.id, "kid-story", { sceneCount: 1 }, undefined, { script: "x".repeat(30) });
    const providers = (app.stories as unknown as { providers: { get: unknown } }).providers;
    const original = providers.get;
    providers.get = () => ({ complete: async () => JSON.stringify({ title: "From Script", synopsis: "", moral: "", scenes: [{ text: "t", narration: "n", imagePrompt: "p", motion: "zoom-in" }] }) });
    try {
      expect((await app.stories.generateScript(story.id)).title).toBe("From Script");
    } finally {
      providers.get = original;
    }
  });
});
