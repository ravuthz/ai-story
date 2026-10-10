import { describe, expect, test } from "bun:test";
import { parseErrorItems } from "../src/lib/errorUtils";

describe("parseErrorItems", () => {
  test("returns empty array for empty or null error", () => {
    expect(parseErrorItems("")).toEqual([]);
    expect(parseErrorItems(null)).toEqual([]);
    expect(parseErrorItems("   ")).toEqual([]);
  });

  test("parses single scene error with step prefix", () => {
    const error = "images: scene 18 — 500 Internal Server Error: Gradio space failed";
    const items = parseErrorItems(error);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Scene 18: Error");
    expect(items[0]!.sceneIndex).toBe(18);
    expect(items[0]!.step).toBe("images");
    expect(items[0]!.message).toBe(error);
  });

  test("parses scene error when message says 'Scene 18 has no image yet'", () => {
    const error = "Scene 18 has no image yet";
    const items = parseErrorItems(error);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Scene 18: Error");
    expect(items[0]!.sceneIndex).toBe(18);
    expect(items[0]!.message).toBe(error);
  });

  test("parses multi-line errors with multiple failed scenes", () => {
    const error = "images: scene 2 — Connection refused\nvideos: scene 18 — ffmpeg failed";
    const items = parseErrorItems(error);
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe("Scene 2: Error");
    expect(items[0]!.sceneIndex).toBe(2);
    expect(items[0]!.step).toBe("images");
    expect(items[0]!.message).toBe("images: scene 2 — Connection refused");

    expect(items[1]!.title).toBe("Scene 18: Error");
    expect(items[1]!.sceneIndex).toBe(18);
    expect(items[1]!.step).toBe("videos");
    expect(items[1]!.message).toBe("videos: scene 18 — ffmpeg failed");
  });

  test("parses general error without scene number", () => {
    const error = "Failed to generate script: Rate limit exceeded";
    const items = parseErrorItems(error);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Error");
    expect(items[0]!.sceneIndex).toBeUndefined();
    expect(items[0]!.message).toBe(error);
  });
});
