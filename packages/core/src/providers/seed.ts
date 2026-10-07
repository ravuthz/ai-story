import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGENT_IDS, type AppConfig } from "../config";
import type { ProviderKind, ProviderRecord } from "../domain/types";
import type { McpProviderConfig } from "./mcp/McpProviders";

export type SeedRecord = Pick<ProviderRecord, "kind" | "slug" | "type" | "label" | "config"> & { enabled?: boolean };

/** Legacy file for user-defined MCP providers: { "mcp": McpProviderConfig[] } next to the storage folder. */
export const MCP_CONFIG_FILE = "providers.config.json";

function loadMcpConfigs(path: string): McpProviderConfig[] {
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf8")) as { mcp?: McpProviderConfig[] }).mcp ?? [];
}

/**
 * The providers that used to be hard-wired from .env and providers.config.json,
 * as rows for the one-time import into the `providers` table.
 */
export function legacyProviders(config: AppConfig): { records: SeedRecord[]; defaults: Record<ProviderKind, string> } {
  const agent = (id: (typeof AGENT_IDS)[number]) => {
    const { bin, model, extraPath } = config.agents[id];
    return { bin, model, extraPath: extraPath ?? [] };
  };
  const records: SeedRecord[] = [
    ...AGENT_IDS.map((id) => ({ kind: "text" as const, slug: id, type: `${id}-cli`, label: "", config: agent(id) })),
    { kind: "image", slug: "codex", type: "codex-image", label: "", config: agent("codex") },
    { kind: "image", slug: "qwen", type: "gradio-image", label: "Qwen-Image (Gradio)", config: legacyQwenConfig({ ...config.qwen, hfToken: config.hfToken }) },
    { kind: "image", slug: "gemini", type: "gemini-image", label: "", config: { apiKey: config.gemini.apiKey, model: config.gemini.imageModel } },
    { kind: "audio", slug: "edge", type: "edge-tts", label: "", config: {} },
    { kind: "audio", slug: "gemini", type: "gemini-tts", label: "", config: { apiKey: config.gemini.apiKey, model: config.gemini.ttsModel } },
    { kind: "video", slug: "ffmpeg", type: "ffmpeg-motion", label: "", config: {} },
    { kind: "video", slug: "gradio", type: "gradio-video", label: "Image-to-video (Gradio)", config: legacyVideoConfig({ ...config.videoGradio, hfToken: config.hfToken }) },
    ...loadMcpConfigs(resolve(config.storageDir, "..", MCP_CONFIG_FILE)).map((m) => ({
      kind: m.kind,
      slug: m.id,
      type: `mcp-${m.kind}`,
      label: m.label ?? `MCP: ${m.id}`,
      config: { server: m.server, tool: m.tool, arguments: m.arguments ?? {} },
    })),
  ];
  return { records, defaults: config.defaults };
}

type LegacyGradio = { url?: unknown; endpoint?: unknown; hfToken?: unknown };

/** The old fixed Qwen-Image call, expressed as a one-connection Gradio provider. */
export const legacyQwenConfig = (c: LegacyGradio) => ({
  hfToken: c.hfToken ?? "",
  connections: c.url ? [{ space: c.url, apiName: c.endpoint || "/infer", params: { prompt: "{{prompt}}", aspect_ratio: "{{aspectRatio}}", randomize_seed: true } }] : [],
});

/** The old fixed image-to-video call (Wan-style spaces), expressed as a one-connection Gradio provider. */
export const legacyVideoConfig = (c: LegacyGradio) => ({
  hfToken: c.hfToken ?? "",
  maxDurationSec: 8,
  connections: c.url
    ? [{ space: c.url, apiName: c.endpoint || "/generate_video", params: { input_image: "{{imagePath}}", prompt: "{{prompt}}", duration_seconds: "{{durationSec}}" } }]
    : [],
});

/** Converts rows written with the pre-generic Gradio drivers ("qwen-gradio", old "gradio-video" shape). */
export function upgradeLegacyGradio(record: Pick<ProviderRecord, "type" | "config">): Pick<ProviderRecord, "type" | "config"> | null {
  if (record.type === "qwen-gradio") return { type: "gradio-image", config: legacyQwenConfig(record.config) };
  if (record.type === "gradio-video" && "url" in record.config) return { type: "gradio-video", config: legacyVideoConfig(record.config) };
  return null;
}

/** A single-endpoint Gradio row ({ space, apiName, params, … }) as a one-connection list. */
export function toConnectionsConfig(config: Record<string, unknown>, enabled = true): Record<string, unknown> | null {
  if (!("space" in config)) return null;
  const { space, apiName, params, valueMaps, meta, hfToken, ...rest } = config;
  // An unconfigured row (blank space) becomes an empty list rather than an invalid connection.
  return { ...rest, hfToken, connections: space ? [{ space, apiName, params, valueMaps, meta, enabled }] : [] };
}

/** VoxCPM inputs filled from the selected cloned voice (all empty when no voice is chosen). */
export const VOXCPM_VOICE_PARAMS = {
  control_instruction: "{{voiceStyle}}",
  reference_wav_path_input: "{{voiceFile}}",
  use_prompt_text: "{{useTranscript}}",
  prompt_text_input: "{{voiceTranscript}}",
};
/** The no-voice defaults the first preset shipped with; only these are replaced by the voice upgrade. */
export const VOXCPM_PLAIN_DEFAULTS: Record<string, unknown> = { control_instruction: "", reference_wav_path_input: null, use_prompt_text: false, prompt_text_input: "" };

const VOXCPM_PARAMS = {
  text_input: "{{text}}",
  ...VOXCPM_VOICE_PARAMS,
  cfg_value_input: 2,
  do_normalize: false,
  denoise: false,
};
// Settings from the original provider list that the /generate endpoint does not take; kept for reference.
const VOXCPM_META = { min_speed: 0.5, max_speed: 4, sample_rate: 48000, inference_timesteps: 10 };
const voxcpm = (space: string) => ({ space, apiName: "/generate", params: VOXCPM_PARAMS, meta: VOXCPM_META });

/** Gradio image and TTS providers added to every install; each tries its connections in order. */
export const GRADIO_PRESETS: SeedRecord[] = [
  {
    kind: "image",
    slug: "qwen-image-2-1",
    label: "Qwen-Image 2.1",
    type: "gradio-image",
    config: {
      timeoutSec: 300,
      connections: [
        {
          space: "hugging-apps/qwen-image-2-1",
          apiName: "/generate",
          params: { prompt: "{{prompt}}", aspect_ratio: "{{aspectRatio}}", seed: "{{seed}}", resolution: 1024 },
        },
        {
          // Off: the space has no /generate_with_enhance; /prepare_request only returns a "Generating image..."
          // placeholder (the real image needs a follow-up call with UI session state), and that "success" would stop the fallback.
          space: "Qwen/Qwen-Image-2.1",
          apiName: "/prepare_request",
          enabled: false,
          params: { original_prompt: "{{prompt}}", enable_extend: true, custom_size: false, quality: "speed", randomize_seed: true },
          meta: { note: "Not usable: /prepare_request returns a placeholder image; generation needs a 2-step call with session state." },
        },
        {
          space: "arudradey/qwen-image-2.1-uncensored-gguf",
          apiName: "/generate",
          params: { prompt: "{{prompt}}", mode: "Create an image", aspect_ratio: "{{aspectRatio}}", randomize_seed: true },
          valueMaps: {
            aspectRatio: { "1:1": "Square · 1:1 (1024x1024)", "16:9": "Landscape · 16:9 (1344x768)", "9:16": "Portrait · 9:16 (768x1344)" },
          },
        },
        {
          space: "Viggle/Qwen-Image-2.1-viggle-turbo",
          apiName: "/generate",
          params: { prompt: "{{prompt}}", size_label: "{{aspectRatio}}", randomize_seed: true },
          valueMaps: {
            aspectRatio: { "1:1": "1:1 · 1024×1024 (1024² area)", "16:9": "16:9 · 1376×768 (1024² area)", "9:16": "9:16 · 768×1376 (1024² area)" },
          },
        },
      ],
    },
  },
  {
    kind: "audio",
    slug: "voxcpm",
    label: "VoxCPM 2",
    type: "gradio-audio",
    config: {
      timeoutSec: 180,
      connections: [voxcpm("openbmb/VoxCPM-Demo"), voxcpm("https://gradio-voxcpm2.appkh.online"), voxcpm("https://gradio-voxcmp.appkh.online/")],
    },
  },
];

/** Separate per-space rows (from the first Gradio preset version) that now live as connections of one provider. */
export const MERGED_GRADIO_GROUPS = [
  { kind: "image" as const, leader: "qwen-image-2-1", members: ["qwen-image-2-1-enhance", "qwen-image-2-1-uncensored", "qwen-image-2-1-viggle"] },
  { kind: "audio" as const, leader: "voxcpm", members: ["voxcpm2-appkh", "voxcpm-appkh"] },
];
