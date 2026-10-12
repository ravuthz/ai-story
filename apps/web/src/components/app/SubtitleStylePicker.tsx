import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { StorySettings } from "@/lib/api";
import { cn } from "@/lib/utils";

type SubtitleStyle = NonNullable<StorySettings["subtitleStyle"]>;

const outline = (px: number, color = "#000") =>
  [`${px}px 0`, `-${px}px 0`, `0 ${px}px`, `0 -${px}px`, `${px}px ${px}px`, `-${px}px -${px}px`, `${px}px -${px}px`, `-${px}px ${px}px`]
    .map((o) => `${o} 0 ${color}`)
    .join(", ");

/** Mirrors the server's ASS presets (packages/core/src/utils/subtitles.ts) closely enough to choose by eye. */
const STYLES: { value: SubtitleStyle; label: string; css?: CSSProperties; className?: string }[] = [
  { value: "none", label: "None" },
  { value: "classic", label: "Classic", css: { color: "#fff", textShadow: outline(1.5) } },
  { value: "boxed", label: "Boxed", css: { color: "#fff" }, className: "rounded-sm bg-black/60 px-1.5 py-0.5" },
  { value: "yellow", label: "Yellow", css: { color: "#ffe600", textShadow: outline(1.5) } },
  { value: "bold", label: "Bold pop", css: { color: "#fff", textShadow: `${outline(2.5)}, 0 3px 4px rgb(0 0 0 / 0.8)` }, className: "text-sm mb-2" },
  { value: "minimal", label: "Minimal", css: { color: "#fff", textShadow: "0 1px 3px rgb(0 0 0 / 0.9)" }, className: "text-[10px] font-medium" },
];

const SAMPLE = { km: ["សួស្តី! នេះជារឿង", "ដែលមានចំណងជើង"], en: ["Once upon a time,", "in a quiet village"] } as const;

/** Burned-in subtitle look; "None" renders clips without subtitles. Shown after the image style picker. */
export function SubtitleStylePicker({
  value = "none",
  onChange,
  language = "km",
}: {
  value?: SubtitleStyle;
  onChange: (value: SubtitleStyle) => void;
  language?: "km" | "en";
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-foreground">Subtitle style</Label>
      <div role="radiogroup" aria-label="Subtitle style" className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:max-w-3xl">
        {STYLES.map(({ value: id, label, css, className }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(id)}
              className={cn(
                "group relative isolate flex aspect-[4/3] cursor-pointer flex-col overflow-hidden rounded-lg border text-left shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "border-primary ring-2 ring-primary/70" : "border-border/80 hover:border-primary/60",
              )}
            >
              <img src="/style-previews/cinematic.webp" alt="" className="absolute inset-0 -z-10 size-full object-cover brightness-75" />
              <span className="flex flex-1 flex-col items-center justify-end pb-1.5 text-center text-xs leading-tight font-bold" lang={language}>
                {id === "none" ? (
                  <span className="mb-auto mt-auto rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/80">No subtitles</span>
                ) : (
                  <span className={className} style={css}>
                    {SAMPLE[language][0]}
                    <br />
                    {SAMPLE[language][1]}
                  </span>
                )}
              </span>
              <span className="bg-card px-2 py-1 text-[11px] font-medium text-foreground">{label}</span>
              {active && (
                <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Burned into each clip when clips render, timed to the narration (max 2 lines on screen).</p>
    </div>
  );
}
