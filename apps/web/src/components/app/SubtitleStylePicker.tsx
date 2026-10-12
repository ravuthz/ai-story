import { useEffect, useState, type CSSProperties } from "react";
import { Captions, Check, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { StorySettings } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Field, SelectField } from "./fields";

type SubtitleStyle = NonNullable<StorySettings["subtitleStyle"]>;
export type SubtitleFont = NonNullable<StorySettings["subtitleFont"]>;
type Language = "km" | "en";
type Animation = "fade" | "pop" | "slide-up" | "karaoke" | "word-by-word" | "typewriter" | "bounce" | "zoom" | "glow" | "slide-left";

const outline = (px: number, color = "#000") =>
  [`${px}px 0`, `-${px}px 0`, `0 ${px}px`, `0 -${px}px`, `${px}px ${px}px`, `-${px}px -${px}px`, `${px}px -${px}px`, `-${px}px ${px}px`]
    .map((o) => `${o} 0 ${color}`)
    .join(", ");

interface StyleDef {
  value: SubtitleStyle;
  label: string;
  /** Relative to the base size, like the server preset's fontScale. */
  scale: number;
  color: string;
  css?: CSSProperties;
  className?: string;
  animation?: Animation;
}

/** Mirrors the server's ASS presets (packages/core/src/utils/subtitles.ts) closely enough to choose by eye. */
const STYLES: StyleDef[] = [
  { value: "none", label: "None", scale: 1, color: "#fff" },
  { value: "classic", label: "Classic", scale: 1, color: "#fff", css: { textShadow: outline(1.5) } },
  { value: "boxed", label: "Boxed", scale: 0.95, color: "#fff", className: "rounded-sm bg-black/60 px-1.5 py-0.5" },
  { value: "yellow", label: "Yellow", scale: 1, color: "#ffe600", css: { textShadow: outline(1.5) } },
  { value: "bold", label: "Bold pop", scale: 1.2, color: "#fff", css: { textShadow: `${outline(2.5)}, 0 3px 4px rgb(0 0 0 / 0.8)` }, className: "mb-2" },
  { value: "minimal", label: "Minimal", scale: 0.85, color: "#fff", css: { textShadow: "0 1px 3px rgb(0 0 0 / 0.9)" } },
  { value: "neon", label: "Neon", scale: 1.05, color: "#66ffff", css: { textShadow: "0 0 2px #0088ff, 0 0 6px #0088ff, 0 0 10px #0088ff" } },
  { value: "highlight", label: "Highlight", scale: 0.95, color: "#000", className: "rounded-sm bg-[#ffe600] px-1.5 py-0.5" },
  { value: "shadow", label: "Soft shadow", scale: 1, color: "#fff", css: { textShadow: "2px 3px 5px rgb(0 0 0 / 0.75)" } },
  { value: "red-outline", label: "Red outline", scale: 1.05, color: "#fff", css: { textShadow: `${outline(2, "#d00000")}, 0 1px 2px rgb(0 0 0 / 0.6)` } },
  { value: "fade", label: "Fade", scale: 1, color: "#fff", css: { textShadow: outline(1.5) }, animation: "fade" },
  { value: "pop", label: "Pop", scale: 1.1, color: "#fff", css: { textShadow: `${outline(2)}, 0 2px 3px rgb(0 0 0 / 0.7)` }, className: "mb-1", animation: "pop" },
  { value: "slide-up", label: "Slide up", scale: 0.95, color: "#fff", className: "rounded-sm bg-black/60 px-1.5 py-0.5", animation: "slide-up" },
  { value: "karaoke", label: "Karaoke", scale: 1.05, color: "#ffe600", css: { textShadow: outline(1.5) }, className: "mb-1", animation: "karaoke" },
  { value: "word-by-word", label: "Word by word", scale: 1.1, color: "#fff", css: { textShadow: outline(2) }, className: "mb-1", animation: "word-by-word" },
  { value: "typewriter", label: "Typewriter", scale: 1, color: "#fff", css: { textShadow: outline(1.5) }, animation: "typewriter" },
  { value: "bounce", label: "Bounce", scale: 1.1, color: "#fff", css: { textShadow: `${outline(2)}, 0 2px 3px rgb(0 0 0 / 0.7)` }, className: "mb-1", animation: "bounce" },
  { value: "zoom", label: "Zoom", scale: 1.05, color: "#fff", css: { textShadow: outline(1.5) }, className: "mb-1", animation: "zoom" },
  { value: "glow", label: "Glow", scale: 1.05, color: "#fff", css: { textShadow: "0 0 2px #ffaa00, 0 0 6px #ffaa00" }, animation: "glow" },
  { value: "slide-left", label: "Slide left", scale: 0.95, color: "#fff", className: "rounded-sm bg-black/60 px-1.5 py-0.5", animation: "slide-left" },
];
/** Animated looks come first: they are the ones worth previewing in motion. */
const GROUPS = [
  { group: "Animated", styles: STYLES.filter((s) => s.animation) },
  { group: "Static", styles: STYLES.filter((s) => !s.animation) },
];
/** Previews that reveal piece by piece (driven by a ticker, not a CSS animation). */
const REVEALS: Animation[] = ["karaoke", "word-by-word", "typewriter"];

/** Characters for the typewriter preview, keeping Khmer stacks (ស + ្ត + ី) whole like the server does. */
function graphemes(line: string): string[] {
  const out: string[] = [];
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(line)) {
    if (out.length && (out.at(-1)!.endsWith("្") || /^[\p{M}្]/u.test(segment))) out[out.length - 1] += segment;
    else out.push(segment);
  }
  return out;
}

const SAMPLE = { km: ["សួស្តី! នេះជារឿង", "ដែលមានចំណងជើង"], en: ["Once upon a time,", "in a quiet village"] } as const;
const DEFAULT_FONT: Record<Language, string> = { km: "Noto Sans Khmer", en: "Arial" };
/** Suggestions only: the font must be installed where clips render (any fontconfig family name works). */
const FONTS: Record<Language, string[]> = {
  km: ["Noto Sans Khmer", "Kantumruy Pro", "Khmer OS Battambang", "Khmer OS Siemreap", "Khmer OS Content", "Khmer OS Bokor", "Khmer OS Koulen", "Khmer OS Moul"],
  en: ["Arial", "Helvetica", "Noto Sans", "Verdana", "Trebuchet MS", "Georgia", "Times New Roman", "Impact", "Courier New"],
};
const FONT_STYLES = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
  { value: "bold-italic", label: "Bold italic" },
];
const ANIMATION_MS = 3000;

/** Word (or character) index reached in a looping reveal preview (all pieces, then a short hold). */
function useWordTicker(active: boolean, count: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), ANIMATION_MS / (count + 4));
    return () => clearInterval(id);
  }, [active, count]);
  return active ? tick % (count + 4) : count;
}

/** Sample subtitle in a style + font overrides, animated like the rendered clip. */
function SubtitleSample({ style, font, language, baseSize }: { style: StyleDef; font: SubtitleFont; language: Language; baseSize: number }) {
  const lines = SAMPLE[language].map((line) =>
    style.animation === "typewriter" ? graphemes(line) : [...new Intl.Segmenter(language, { granularity: "word" }).segment(line)].map((s) => s.segment),
  );
  const wordCount = lines.flat().length;
  const animated = !!style.animation && REVEALS.includes(style.animation);
  const reached = useWordTicker(animated, wordCount);
  const color = font.color ?? style.color;
  const css: CSSProperties = {
    ...style.css,
    color: style.animation === "karaoke" ? "#fff" : color,
    fontFamily: `"${font.name?.trim() || DEFAULT_FONT[language]}", sans-serif`,
    fontSize: baseSize * style.scale * ((font.size ?? 100) / 100),
    fontWeight: font.bold ?? true ? 700 : 400,
    fontStyle: font.italic ? "italic" : "normal",
    ...(style.animation && !animated && { animation: `subtitle-${style.animation} ${ANIMATION_MS}ms ease-out infinite` }),
  };
  let index = 0;
  return (
    <span key={style.value} data-subtitle-animation={style.animation} className={cn("inline-block leading-tight", style.className)} style={css} lang={language}>
      {lines.map((words, l) => (
        <span key={l} className="block">
          {words.map((word, w) => {
            const spoken = index++ < reached;
            return (
              <span
                key={w}
                style={
                  style.animation === "karaoke" ? { color: spoken ? color : "#fff" } : style.animation === "word-by-word" || style.animation === "typewriter" ? { visibility: spoken ? "visible" : "hidden" } : undefined
                }
              >
                {word}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** A scene still with the sample subtitle at the bottom, as it is burned into clips. */
function SubtitleFrame({ style, font, language, baseSize, className }: { style: StyleDef; font: SubtitleFont; language: Language; baseSize: number; className?: string }) {
  return (
    <div className={cn("relative isolate flex flex-col items-center justify-end overflow-hidden text-center", className)}>
      <img src="/style-previews/cinematic.webp" alt="" className="absolute inset-0 -z-10 size-full object-cover brightness-75" />
      {style.value === "none" ? (
        <span className="m-auto rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/80">No subtitles</span>
      ) : (
        <span className="pb-[8%]">
          <SubtitleSample style={style} font={font} language={language} baseSize={baseSize} />
        </span>
      )}
    </div>
  );
}

const fontStyleOf = (font: SubtitleFont) => `${font.bold ?? true ? "bold" : ""}${font.italic ? (font.bold ?? true ? "-italic" : "italic") : ""}` || "normal";

/** Burned-in subtitle look and font; "None" renders clips without subtitles. Opens a popup like the image style picker. */
export function SubtitleStylePicker({
  value = "none",
  onChange,
  font = {},
  onFontChange,
  language = "km",
}: {
  value?: SubtitleStyle;
  onChange: (value: SubtitleStyle) => void;
  font?: SubtitleFont;
  onFontChange: (font: SubtitleFont) => void;
  language?: Language;
}) {
  const [open, setOpen] = useState(false);
  const selected = STYLES.find((s) => s.value === value) ?? STYLES[0]!;
  const off = value === "none";
  // Empty overrides are dropped so the story keeps the style's own look; {} (not undefined) clears a saved font.
  const setFont = (patch: Partial<SubtitleFont>) =>
    onFontChange(Object.fromEntries(Object.entries({ ...font, ...patch }).filter(([, v]) => v !== undefined && v !== "")) as SubtitleFont);
  const customized = Object.keys(font).length > 0;
  const summary = off
    ? "Clips render without subtitles"
    : [font.name?.trim() || DEFAULT_FONT[language], `${font.size ?? 100}%`, FONT_STYLES.find((s) => s.value === fontStyleOf(font))!.label, font.color].filter(Boolean).join(" · ");

  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-foreground">Subtitle style</Label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex w-full cursor-pointer items-center gap-3 rounded-xl border border-input bg-card p-2.5 text-left shadow-2xs transition-all hover:border-primary/50 hover:bg-card/90 hover:shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-md",
          !off && "border-primary/30 bg-primary/[0.02]",
        )}
      >
        <SubtitleFrame style={selected} font={font} language={language} baseSize={6} className="h-14 w-20 shrink-0 rounded-lg border border-border/80" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <span className="block truncate text-sm font-semibold text-foreground">
            {selected.label}
            {selected.animation && <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">animated</span>}
          </span>
          <p className="truncate font-mono text-xs text-muted-foreground">{summary}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
            <Captions className="size-3 shrink-0 text-primary/70" />
            <span>Click to choose style and font</span>
          </p>
        </div>
        <ChevronRight className="mr-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>
      <p className="text-xs text-muted-foreground">Burned into each clip when clips render, timed to the narration (max 2 lines on screen).</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="z-[70] flex max-h-[85vh] w-[80vw] max-w-[80vw] flex-col gap-3 overflow-y-auto rounded-2xl border bg-popover p-4 shadow-2xl sm:max-w-[80vw]"
          overlayClassName="z-[65] bg-black/60 backdrop-blur-xs"
        >
          <div className="border-b border-border/60 pr-8 pb-2">
            <DialogTitle className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Captions className="size-4 text-primary" /> Subtitle Style
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">Choose a look, then adjust the font. The preview loops like the rendered clip.</DialogDescription>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              {GROUPS.map(({ group, styles }) => (
                <section key={group} className="space-y-2" aria-label={`${group} subtitle styles`}>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {group === "Animated" && <Sparkles className="size-3.5 text-primary" />} {group}
                  </h3>
                  <div role="radiogroup" aria-label={`${group} subtitle styles`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {styles.map((style) => {
                      const active = value === style.value;
                      return (
                        <button
                          key={style.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => onChange(style.value)}
                          className={cn(
                            "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            active ? "border-primary ring-2 ring-primary/70" : "border-border/80 hover:border-primary/60 hover:shadow-md",
                          )}
                        >
                          <SubtitleFrame style={style} font={font} language={language} baseSize={12} className="aspect-[4/3]" />
                          <span className="bg-card px-2 py-1 text-xs font-medium text-foreground">{style.label}</span>
                          {active && (
                            <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                              <Check className="size-3.5 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <section className="grid content-start gap-3 rounded-xl border bg-card p-3" aria-label="Subtitle font">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Font</h3>
                <Button type="button" size="xs" variant="ghost" disabled={!customized} onClick={() => onFontChange({})}>
                  <RotateCcw /> Reset
                </Button>
              </div>
              <SubtitleFrame style={selected} font={font} language={language} baseSize={18} className="aspect-video rounded-lg" />
              <fieldset disabled={off} className="grid gap-3 disabled:opacity-50">
                <Field label="Font name" hint="Must be installed on the machine that renders clips">
                  <Input
                    list="subtitle-fonts"
                    value={font.name ?? ""}
                    placeholder={DEFAULT_FONT[language]}
                    onChange={(e) => setFont({ name: e.target.value.replace(/[,{}\\]/g, "") || undefined })}
                  />
                  <datalist id="subtitle-fonts">
                    {FONTS[language].map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </Field>
                <Field label={`Size · ${font.size ?? 100}%`}>
                  <Slider
                    min={50}
                    max={200}
                    step={5}
                    value={[font.size ?? 100]}
                    disabled={off}
                    onValueChange={(v) => {
                      const size = Array.isArray(v) ? v[0]! : v;
                      setFont({ size: size === 100 ? undefined : size });
                    }}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Subtitle color"
                        value={font.color ?? (selected.color === "#fff" ? "#ffffff" : selected.color)}
                        onChange={(e) => setFont({ color: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                      />
                      {font.color && (
                        <button type="button" className="cursor-pointer text-[11px] text-muted-foreground hover:text-destructive" onClick={() => setFont({ color: undefined })}>
                          Default
                        </button>
                      )}
                    </div>
                  </Field>
                  <SelectField
                    label="Style"
                    value={fontStyleOf(font)}
                    options={FONT_STYLES}
                    onChange={(v) => setFont({ bold: v.startsWith("bold") ? undefined : false, italic: v.endsWith("italic") || undefined })}
                  />
                </div>
                {value === "karaoke" && <p className="text-xs text-muted-foreground">Karaoke: the colour is the highlight of spoken words.</p>}
              </fieldset>
            </section>
          </div>

          <div className="flex items-center justify-end border-t border-border/60 pt-2">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
