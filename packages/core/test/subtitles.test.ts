import { describe, expect, test } from "bun:test";
import { buildAss, chunkSubtitles, fitCuesToClip, subtitleLayout, textWidth, timeCues } from "../src/utils/subtitles";

describe("subtitles", () => {
  test("cues never exceed two lines or the line width", () => {
    const text = "Once upon a time a small fox lived at the edge of a dark forest. Every night it watched the stars and wondered where they went in the morning, and nobody could tell it.";
    const cues = chunkSubtitles(text, "en", 24);
    expect(cues.length).toBeGreaterThan(2);
    for (const cue of cues) {
      expect(cue.length).toBeLessThanOrEqual(2);
      for (const line of cue) expect(textWidth(line)).toBeLessThanOrEqual(25);
    }
    expect(cues.flat().join(" ")).toBe(text);
  });

  test("unspaced Khmer wraps between words", () => {
    const text = "ព្រះអាទិត្យរះនៅពេលព្រឹក ហើយក្មេងប្រុសម្នាក់បានដើរទៅសាលារៀនជាមួយមិត្តភក្តិរបស់គាត់។";
    const cues = chunkSubtitles(text, "km", 12);
    for (const cue of cues) {
      expect(cue.length).toBeLessThanOrEqual(2);
      for (const line of cue) expect(textWidth(line)).toBeLessThanOrEqual(13);
    }
    expect(cues.flat().join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });

  test("timing skips silences and snaps to pauses", () => {
    const cues = timeCues([["First sentence here."], ["Second one."]], [
      { startSec: 0.5, endSec: 2.5 },
      { startSec: 3.2, endSec: 4.4 },
    ]);
    expect(cues[0]!.startSec).toBeCloseTo(0.5);
    expect(cues[1]!.startSec).toBeCloseTo(3.2);
    expect(cues[0]!.endSec).toBeLessThanOrEqual(cues[1]!.startSec);
    expect(cues[1]!.endSec).toBeCloseTo(4.7);
  });

  test("ASS output uses manual breaks only", () => {
    const ass = buildAss([{ startSec: 1, endSec: 2.5, lines: ["a {b}", "c"] }], subtitleLayout("9:16", "en"));
    expect(ass).toContain("WrapStyle: 2");
    expect(ass).toContain("Dialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,a \\{b\\}\\Nc");
  });

  test("cues follow sped-up narration and drop speech cut off by the clip", () => {
    const cues = [
      { startSec: 0.2, endSec: 2, lines: ["a"] },
      { startSec: 2, endSec: 4, lines: ["b"] },
      { startSec: 4, endSec: 6, lines: ["c"] },
    ];
    const fitted = fitCuesToClip(cues, 2, 2.2, 0.4);
    expect(fitted.map((c) => c.lines[0])).toEqual(["a", "b"]);
    expect(fitted[0]!.startSec).toBeCloseTo(0.1);
    expect(fitted[1]!.endSec).toBeCloseTo(2);
  });

  test("styles change size and position; none measures like classic", () => {
    const classic = subtitleLayout("9:16", "km", "classic");
    expect(subtitleLayout("9:16", "km", "none")).toEqual(classic);
    const bold = subtitleLayout("9:16", "km", "bold");
    expect(bold.fontSize).toBeGreaterThan(classic.fontSize);
    expect(bold.lineWidth).toBeLessThan(classic.lineWidth);
    expect(buildAss([], subtitleLayout("16:9", "en", "boxed"))).toMatch(/,3,\d+,0,2,/);
  });
});
