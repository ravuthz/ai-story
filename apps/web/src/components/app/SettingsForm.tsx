import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useProviders, useVoices } from "@/hooks/queries";
import type { ProviderInfo, SettingsInput } from "@/lib/api";
import { NumberField, SelectField, TextField, type Option } from "./fields";

const LANGUAGES: Option[] = [
  { value: "km", label: "Khmer (ខ្មែរ)" },
  { value: "en", label: "English" },
];
const ASPECTS: Option[] = [
  { value: "9:16", label: "9:16 · Shorts / TikTok" },
  { value: "16:9", label: "16:9 · YouTube" },
  { value: "1:1", label: "1:1 · Square" },
];
const KINDS = ["text", "image", "audio", "video"] as const;
const DEFAULT_SCENE_SEC = 10;
const STYLE_TAGS = [
  "cinematic",
  "highly detailed",
  "dramatic lighting",
  "photorealistic",
  "anime",
  "3D render",
  "watercolor",
  "oil painting",
  "Pixar style",
  "dark fantasy",
];

const splitTags = (style = "") => style.split(",").map((t) => t.trim()).filter(Boolean);
/** Adds the tag to a comma-separated style string, or removes it if already present. */
const toggleTag = (style: string | undefined, tag: string) => {
  const tags = splitTags(style);
  const has = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  return (has ? tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...tags, tag]).join(", ");
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n) || min));
const MAX_SCENES = 60;
const MIN_DURATION = 5;
const MAX_DURATION = 3600;

const providerOptions = (providers: ProviderInfo[] = [], kind: ProviderInfo["kind"]): Option[] =>
  providers
    .filter((p) => p.kind === kind)
    .map((p) => ({ value: p.id, label: `${p.label}${p.available ? "" : " (unavailable)"}`, disabled: !p.available }));

/** Shared editor for per-story settings: used by "new story", "batch" and the story page. */
export function SettingsForm({ value, onChange }: { value: SettingsInput; onChange: (next: SettingsInput) => void }) {
  const { data: providers } = useProviders();
  const { data: voices } = useVoices();
  const set = <K extends keyof SettingsInput>(key: K, v: SettingsInput[K]) => onChange({ ...value, [key]: v });
  const language = value.narrationLanguage ?? "km";
  // Duration = Scenes × Sec / scene; editing any one of them recalculates the others.
  const [sceneSec, setSceneSec] = useState(DEFAULT_SCENE_SEC);
  const totalFor = (scenes: number, sec: number) => clamp(scenes * sec, MIN_DURATION, MAX_DURATION);
  const setScenes = (v: number) => {
    const sceneCount = clamp(v, 1, MAX_SCENES);
    onChange({ ...value, sceneCount, durationSec: totalFor(sceneCount, sceneSec) });
  };
  // Sec / scene stays fixed, so a new duration changes the scene count.
  // The typed value is kept as-is (clamping mid-typing would fight the user); only the scene count follows it.
  const setDuration = (durationSec: number) =>
    onChange({ ...value, durationSec, sceneCount: clamp(durationSec / sceneSec, 1, MAX_SCENES) });
  const setSec = (v: number) => {
    const sec = clamp(v, 1, 600);
    setSceneSec(sec);
    onChange({ ...value, durationSec: totalFor(value.sceneCount ?? 1, sec) });
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <NumberField label="Scenes" min={1} max={MAX_SCENES} value={value.sceneCount} onChange={setScenes} />
        <NumberField label="Sec / scene" min={1} max={600} value={sceneSec} onChange={setSec} />
        <NumberField label="Duration (sec)" min={MIN_DURATION} max={MAX_DURATION} value={value.durationSec} onChange={setDuration} />
        <SelectField label="Narration" value={language} options={LANGUAGES} onChange={(v) => onChange({ ...value, narrationLanguage: v as "km" | "en", voice: undefined })} />
        <SelectField label="Aspect ratio" value={value.aspectRatio ?? "9:16"} options={ASPECTS} onChange={(v) => set("aspectRatio", v as SettingsInput["aspectRatio"])} />
      </div>
      <div className="grid gap-2">
        <TextField label="Image style" value={value.imageStyle} onChange={(v) => set("imageStyle", v)} placeholder="cinematic, highly detailed, dramatic lighting" />
        <div className="flex flex-wrap gap-1.5">
          {STYLE_TAGS.map((tag) => {
            const active = splitTags(value.imageStyle).some((t) => t.toLowerCase() === tag.toLowerCase());
            return (
              <Button key={tag} type="button" size="xs" variant={active ? "default" : "outline"} aria-pressed={active} onClick={() => set("imageStyle", toggleTag(value.imageStyle, tag))}>
                {tag}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {KINDS.map((kind) => (
          <SelectField
            key={kind}
            label={`${kind[0]!.toUpperCase()}${kind.slice(1)} provider`}
            placeholder={`Default (${providers?.defaults[kind] ?? "…"})`}
            value={value.providers?.[kind]}
            options={providerOptions(providers?.providers, kind)}
            onChange={(v) => set("providers", { ...value.providers, [kind]: v })}
          />
        ))}
        <SelectField
          label="Voice"
          value={value.voice}
          options={(voices?.[language] ?? []).map((v) => ({ value: v, label: v }))}
          onChange={(v) => set("voice", v)}
        />
      </div>
    </div>
  );
}

export const DEFAULT_SETTINGS: SettingsInput = {
  sceneCount: 6,
  durationSec: 6 * DEFAULT_SCENE_SEC,
  narrationLanguage: "km",
  aspectRatio: "9:16",
  providers: {},
};
