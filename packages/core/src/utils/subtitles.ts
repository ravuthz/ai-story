import type { AspectRatio, Language, SubtitleStyle } from "../domain/types";
import { DIMENSIONS } from "./media";

/** A time range (seconds) where narration is audible. */
export interface Span {
  startSec: number;
  endSec: number;
}

export interface SubtitleCue extends Span {
  /** One or two lines shown together. */
  lines: string[];
}

export interface SubtitleLayout {
  style: SubtitlePreset;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  marginH: number;
  marginV: number;
  /** Approximate visible characters that fit on one line. */
  lineWidth: number;
}

export const MAX_LINES = 2;
const SENTENCE_END = /[.!?។៕…]["'”’)]*$/u;
const CLAUSE_END = /[,;:៖、]["'”’)]*$/u;
/** Average glyph width in em per counted character. */
const EM_PER_CHAR: Record<Language, number> = { km: 0.62, en: 0.5 };
/** Readability cap on characters per line, whatever the frame width. */
const MAX_LINE_WIDTH: Record<Language, number> = { km: 30, en: 42 };
const FONTS: Record<Language, string> = { km: "Noto Sans Khmer", en: "Arial" };

/** How a subtitle style looks. Colours are ASS &HAABBGGRR (AA: 00 opaque, FF transparent). */
export interface SubtitlePreset {
  fontScale: number;
  primary: string;
  outlineColour: string;
  back: string;
  /** Outline width as a fraction of the font size; for a box it is the padding. */
  outline: number;
  shadow: number;
  /** Opaque box behind the text (ASS BorderStyle 3) instead of an outline. */
  box?: boolean;
  /** Distance from the bottom as a fraction of the height, before the portrait boost. */
  bottom: number;
}

export const SUBTITLE_PRESETS: Record<Exclude<SubtitleStyle, "none">, SubtitlePreset> = {
  classic: { fontScale: 1, primary: "&H00FFFFFF", outlineColour: "&H00000000", back: "&H96000000", outline: 0.07, shadow: 1, bottom: 0.07 },
  boxed: { fontScale: 0.95, primary: "&H00FFFFFF", outlineColour: "&H64000000", back: "&H64000000", outline: 0.18, shadow: 0, box: true, bottom: 0.07 },
  yellow: { fontScale: 1, primary: "&H0000E6FF", outlineColour: "&H00000000", back: "&H96000000", outline: 0.07, shadow: 1, bottom: 0.07 },
  bold: { fontScale: 1.2, primary: "&H00FFFFFF", outlineColour: "&H00000000", back: "&H00000000", outline: 0.12, shadow: 3, bottom: 0.2 },
  minimal: { fontScale: 0.85, primary: "&H00FFFFFF", outlineColour: "&H80000000", back: "&H80000000", outline: 0.03, shadow: 2, bottom: 0.06 },
};

/** Layout for a style; "none" (or no style) measures like "classic" so cues can still be prepared. */
export function subtitleLayout(aspectRatio: AspectRatio, language: Language, styleId: SubtitleStyle = "classic"): SubtitleLayout {
  const style = SUBTITLE_PRESETS[styleId === "none" ? "classic" : styleId];
  const { width, height } = DIMENSIONS[aspectRatio];
  const fontSize = Math.round(Math.min(width, height) * 0.058 * style.fontScale);
  const marginH = Math.round(width * 0.07);
  // Portrait videos keep subtitles above the platform's caption/controls overlay.
  const marginV = Math.round(height * (style.bottom + (height > width ? 0.07 : 0)));
  const fit = Math.floor((width - 2 * marginH) / (fontSize * EM_PER_CHAR[language]));
  return { style, width, height, fontName: FONTS[language], fontSize, marginH, marginV, lineWidth: Math.min(fit, MAX_LINE_WIDTH[language]) };
}

/** Visible width in characters: combining marks and Khmer subscript consonants take no extra space. */
export function textWidth(text: string): number {
  let width = 0;
  let afterCoeng = false;
  for (const ch of text) {
    if (ch === "្") afterCoeng = true;
    else if (afterCoeng) afterCoeng = false;
    else if (!/\p{M}|​/u.test(ch)) width++;
  }
  return width;
}

/**
 * Splits narration into cues of at most two lines, each line at most `lineWidth` wide.
 * Lines break only between words (Intl.Segmenter handles unspaced Khmer); cues prefer sentence ends.
 */
export function chunkSubtitles(text: string, language: Language, lineWidth: number): string[][] {
  const segmenter = new Intl.Segmenter(language, { granularity: "word" });
  const sentences: string[][] = [];
  let lines: string[] = [];
  let line = "";
  const pushLine = () => {
    if (line.trim()) lines.push(line.trim());
    line = "";
  };
  const pushSentence = () => {
    pushLine();
    if (lines.length) sentences.push(lines);
    lines = [];
  };

  for (const { segment, isWordLike } of segmenter.segment(text.replace(/\s+/g, " ").trim())) {
    if (segment === " ") {
      if (line) line += " ";
      continue;
    }
    // Punctuation sticks to the line it ends, even if that overflows slightly.
    if (!isWordLike && line.trim()) {
      line = line.trimEnd() + segment;
    } else {
      if (textWidth(line + segment) > lineWidth) pushLine();
      line += segment;
      // A single word wider than a line is hard-split.
      while (textWidth(line) > lineWidth) {
        const chars = [...line];
        let cut = 0;
        while (cut < chars.length && textWidth(chars.slice(0, cut + 1).join("")) <= lineWidth) cut++;
        line = chars.slice(0, Math.max(1, cut)).join("");
        pushLine();
        line = chars.slice(Math.max(1, cut)).join("");
      }
    }
    if (SENTENCE_END.test(line.trimEnd())) pushSentence();
  }
  pushSentence();

  const cues: string[][] = [];
  for (const sentence of sentences) {
    for (let i = 0; i < sentence.length; i += MAX_LINES) cues.push(sentence.slice(i, i + MAX_LINES));
  }
  // Two consecutive one-line cues (short sentences) share the screen instead of flashing by.
  const merged: string[][] = [];
  for (const cue of cues) {
    const last = merged.at(-1);
    if (last?.length === 1 && cue.length === 1 && !CLAUSE_END.test(last[0]!) && cueWeight(last) + cueWeight(cue) <= lineWidth * 1.5) last.push(cue[0]!);
    else merged.push(cue);
  }
  return merged;
}

const cueWeight = (lines: string[]) => Math.max(1, textWidth(lines.join("").replace(/\s/g, "")));

/**
 * Times cues against the audible spans of the narration: the voiced time is shared out by text length,
 * skipping silences, and cue boundaries snap to a nearby pause so they change when the speaker breathes.
 */
export function timeCues(chunks: string[][], spans: Span[]): SubtitleCue[] {
  const voiced = spans.filter((s) => s.endSec > s.startSec);
  const total = voiced.reduce((sum, s) => sum + (s.endSec - s.startSec), 0);
  if (!chunks.length || total <= 0) return [];

  // Voiced-time positions of every pause (span edges), used for snapping.
  const pauses: number[] = [];
  let acc = 0;
  for (const s of voiced.slice(0, -1)) pauses.push((acc += s.endSec - s.startSec));

  const weights = chunks.map(cueWeight);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const bounds = [0];
  let cum = 0;
  for (const w of weights) bounds.push(((cum += w) / weightSum) * total);
  const tolerance = Math.min(1.2, total * 0.12);
  for (let i = 1; i < bounds.length - 1; i++) {
    const near = pauses.filter((p) => Math.abs(p - bounds[i]!) <= tolerance && p > bounds[i - 1]! + 0.3 && p < bounds[i + 1]! - 0.3);
    if (near.length) bounds[i] = near.reduce((a, b) => (Math.abs(b - bounds[i]!) < Math.abs(a - bounds[i]!) ? b : a));
  }

  // Voiced position → real time; a position on a pause starts after it but ends before it.
  const toTime = (pos: number, isEnd: boolean) => {
    let start = 0;
    for (const s of voiced) {
      const len = s.endSec - s.startSec;
      if (isEnd ? pos <= start + len : pos < start + len) return s.startSec + (pos - start);
      start += len;
    }
    return voiced.at(-1)!.endSec;
  };

  const cues = chunks.map((lines, i) => ({ lines, startSec: toTime(bounds[i]!, false), endSec: toTime(bounds[i + 1]!, true) }));
  // Close short gaps so the text doesn't blink off between cues; hold the last one a beat.
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i + 1]!.startSec - cues[i]!.endSec < 0.6) cues[i]!.endSec = cues[i + 1]!.startSec;
  }
  cues.at(-1)!.endSec += 0.3;
  return cues;
}

const assTime = (sec: number) => {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360_000);
  const m = Math.floor(cs / 6000) % 60;
  const s = Math.floor(cs / 100) % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};

const assText = (line: string) => line.replace(/\\/g, "\\\\").replace(/[{}]/g, (c) => `\\${c}`);

/** An ASS script with manual line breaks only (WrapStyle 2), so a cue never exceeds two lines. */
export function buildAss(cues: SubtitleCue[], layout: SubtitleLayout): string {
  const { style, width, height, fontName, fontSize, marginH, marginV } = layout;
  const outline = Math.max(style.box ? 4 : 1, Math.round(fontSize * style.outline));
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${fontName},${fontSize},${style.primary},&H000000FF,${style.outlineColour},${style.back},-1,0,0,0,100,100,0,0,${style.box ? 3 : 1},${outline},${style.shadow},2,${marginH},${marginH},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...cues
      .filter((c) => c.endSec > c.startSec)
      .map((c) => `Dialogue: 0,${assTime(c.startSec)},${assTime(c.endSec)},Default,,0,0,0,,${c.lines.slice(0, MAX_LINES).map(assText).join("\\N")}`),
    "",
  ].join("\n");
}

/** Stored per scene: cues timed to the narration audio, plus what they were built from (to detect staleness). */
export interface SceneSubtitles {
  text: string;
  lineWidth: number;
  cues: SubtitleCue[];
}

/**
 * Maps narration-timed cues onto a clip that plays the narration `tempo`× faster and lasts `clipSec`:
 * speech cut off by the clip's end loses its cues, and nothing stays up through the fade-out.
 */
export function fitCuesToClip(cues: SubtitleCue[], tempo: number, clipSec: number, fadeSec: number): SubtitleCue[] {
  const end = Math.max(0, clipSec - fadeSec / 2);
  return cues
    .map((c) => ({ ...c, startSec: c.startSec / tempo, endSec: Math.min(c.endSec / tempo, end) }))
    .filter((c) => c.startSec < end && c.endSec - c.startSec >= 0.2);
}
