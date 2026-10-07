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
  const perScene = value.durationSec && value.sceneCount ? (value.durationSec / value.sceneCount).toFixed(1) : "—";

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Scenes" min={1} max={60} value={value.sceneCount} onChange={(v) => set("sceneCount", v)} />
        <NumberField
          label="Duration (sec)"
          min={5}
          max={3600}
          value={value.durationSec}
          onChange={(v) => set("durationSec", v)}
          hint={`≈ ${perScene}s / scene`}
        />
        <SelectField label="Narration" value={language} options={LANGUAGES} onChange={(v) => onChange({ ...value, narrationLanguage: v as "km" | "en", voice: undefined })} />
        <SelectField label="Aspect ratio" value={value.aspectRatio ?? "9:16"} options={ASPECTS} onChange={(v) => set("aspectRatio", v as SettingsInput["aspectRatio"])} />
      </div>
      <TextField label="Image style" value={value.imageStyle} onChange={(v) => set("imageStyle", v)} placeholder="cinematic, highly detailed, dramatic lighting" />
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
  durationSec: 60,
  narrationLanguage: "km",
  aspectRatio: "9:16",
  providers: {},
};
