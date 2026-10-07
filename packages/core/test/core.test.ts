import { describe, expect, test } from "bun:test";
import { App } from "../src/App";
import { config } from "../src/config";
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
