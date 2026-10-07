import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useProviders, useVoiceOptions } from "@/hooks/queries";
import { AudioLines, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProviderInfo, SettingsInput, VoiceOptions } from "@/lib/api";
import { Field, NumberField, SelectField, TextField, type Option } from "./fields";

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

const VOICE_KINDS = { clone: { tab: "Use clone voice" }, design: { tab: "Design a voice" } } as const;
type VoiceMode = keyof typeof VOICE_KINDS;

/**
 * Voice picker. For providers with custom voices the story chooses a cloned voice or a voice description;
 * left empty, the provider's own voice (set in its voices dialog) is used. The server refuses a mismatch.
 */
function VoiceField({ value, onChange, options }: { value: SettingsInput; onChange: (next: SettingsInput) => void; options?: VoiceOptions }) {
  const all = options?.voices ?? [];
  const selected = all.find((v) => v.value === value.voice);
  if (!options?.cloning) {
    return (
      <SelectField
        label="Voice"
        placeholder="Default voice"
        value={value.voice}
        options={[{ value: "", label: "Default voice" }, ...all]}
        onChange={(v) => onChange({ ...value, voice: v || undefined })}
      />
    );
  }
  const fallback = options.defaultVoice;
  const mode: VoiceMode = value.voiceMode ?? selected?.mode ?? fallback?.mode ?? "clone";
  const clones = all.filter((v) => v.mode === "clone");
  const providerVoice =
    fallback?.mode === "clone" && fallback.voiceName ? `Provider's voice (${fallback.voiceName})` : "Provider's default voice";
  const providerDescription = fallback?.mode === "design" ? fallback.description : undefined;
  return (
    <Field label="Voice" className="sm:col-span-2">
      <Tabs
        value={mode}
        // Switching kind keeps the voice only if it already is of that kind.
        onValueChange={(m) => onChange({ ...value, voiceMode: m as VoiceMode, voice: selected?.mode === m ? value.voice : undefined })}
      >
        <TabsList className="w-full">
          {(Object.keys(VOICE_KINDS) as VoiceMode[]).map((m) => (
            <TabsTrigger key={m} value={m}>
              {m === "clone" ? <AudioLines /> : <Sparkles />} {VOICE_KINDS[m].tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {mode === "clone" ? (
        <SelectField
          label="Cloned voice"
          placeholder={providerVoice}
          value={selected?.mode === "clone" ? value.voice : undefined}
          options={[{ value: "", label: providerVoice }, ...clones]}
          onChange={(v) => onChange({ ...value, voiceMode: "clone", voice: v || undefined })}
          hint={clones.length ? undefined : "No cloned voices yet: upload one on Providers → Audio → Clone / design voices"}
        />
      ) : (
        <TextField
          label={providerDescription ? "Voice description" : "Voice description *"}
          multiline
          rows={2}
          value={value.voiceDescription}
          onChange={(v) => onChange({ ...value, voiceMode: "design", voice: undefined, voiceDescription: v || undefined })}
          placeholder={providerDescription ?? "A young woman with a bright, warm voice, speaking gently"}
          hint={providerDescription ? "Blank uses the provider's voice description" : "Required: describe the voice (no provider description is set)"}
        />
      )}
    </Field>
  );
}

/** Shared editor for per-story settings: used by "new story", "batch" and the story page. */
export function SettingsForm({ value, onChange }: { value: SettingsInput; onChange: (next: SettingsInput) => void }) {
  const { data: providers } = useProviders();
  const { data: voiceOptions } = useVoiceOptions(value.providers?.audio, value.narrationLanguage ?? "km");
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
            // A voice belongs to one audio provider, so switching provider clears it.
            onChange={(v) => onChange({ ...value, providers: { ...value.providers, [kind]: v }, ...(kind === "audio" && { voice: undefined, voiceMode: undefined }) })}
          />
        ))}
        <VoiceField value={value} onChange={onChange} options={voiceOptions} />
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
