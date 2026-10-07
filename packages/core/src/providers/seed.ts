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

/** The old fixed Qwen-Image call, expressed in the generic Gradio format. */
export const legacyQwenConfig = (c: LegacyGradio) => ({
  space: c.url ?? "",
  apiName: c.endpoint || "/infer",
  hfToken: c.hfToken ?? "",
  params: { prompt: "{{prompt}}", aspect_ratio: "{{aspectRatio}}", randomize_seed: true },
});

/** The old fixed image-to-video call (Wan-style spaces), expressed in the generic Gradio format. */
export const legacyVideoConfig = (c: LegacyGradio) => ({
  space: c.url ?? "",
  apiName: c.endpoint || "/generate_video",
  hfToken: c.hfToken ?? "",
  params: { input_image: "{{imagePath}}", prompt: "{{prompt}}", duration_seconds: "{{durationSec}}" },
  maxDurationSec: 8,
});

/** Converts rows written with the pre-generic Gradio drivers ("qwen-gradio", old "gradio-video" shape). */
export function upgradeLegacyGradio(record: Pick<ProviderRecord, "type" | "config">): Pick<ProviderRecord, "type" | "config"> | null {
  if (record.type === "qwen-gradio") return { type: "gradio-image", config: legacyQwenConfig(record.config) };
  if (record.type === "gradio-video" && "url" in record.config) return { type: "gradio-video", config: legacyVideoConfig(record.config) };
  return null;
}

const VOXCPM_PARAMS = {
  text_input: "{{text}}",
  control_instruction: "",
  reference_wav_path_input: null,
  use_prompt_text: false,
  prompt_text_input: "",
  cfg_value_input: 2,
  do_normalize: false,
  denoise: false,
};
// Settings from the original provider list that the /generate endpoint does not take; kept for reference.
const VOXCPM_META = { min_speed: 0.5, max_speed: 4, sample_rate: 48000, inference_timesteps: 10 };

const voxcpm = (slug: string, label: string, space: string): SeedRecord => ({
  kind: "audio",
  slug,
  label,
  type: "gradio-audio",
  config: { space, apiName: "/generate", params: VOXCPM_PARAMS, meta: VOXCPM_META },
});

/** Gradio image and TTS spaces added to every install. */
export const GRADIO_PRESETS: SeedRecord[] = [
  {
    kind: "image",
    slug: "qwen-image-2-1",
    label: "Qwen-Image 2.1 (hugging-apps)",
    type: "gradio-image",
    config: {
      space: "hugging-apps/qwen-image-2-1",
      apiName: "/generate",
      params: { prompt: "{{prompt}}", aspect_ratio: "{{aspectRatio}}", seed: "{{seed}}", resolution: 1024 },
    },
  },
  {
    kind: "image",
    slug: "qwen-image-2-1-enhance",
    label: "Qwen-Image 2.1 + prompt enhance (official)",
    type: "gradio-image",
    // Disabled: the space has no /generate_with_enhance; /prepare_request only returns a "Generating image..."
    // placeholder and the real image comes from a follow-up /generate_request that needs the UI's session state.
    enabled: false,
    config: {
      space: "Qwen/Qwen-Image-2.1",
      apiName: "/prepare_request",
      params: { original_prompt: "{{prompt}}", enable_extend: true, custom_size: false, quality: "speed", randomize_seed: true },
      meta: { note: "Not usable yet: /prepare_request returns a placeholder image; generation needs a 2-step call with session state." },
    },
  },
  {
    kind: "image",
    slug: "qwen-image-2-1-uncensored",
    label: "Qwen-Image 2.1 uncensored GGUF",
    type: "gradio-image",
    config: {
      space: "arudradey/qwen-image-2.1-uncensored-gguf",
      apiName: "/generate",
      params: { prompt: "{{prompt}}", mode: "Create an image", aspect_ratio: "{{aspectRatio}}", randomize_seed: true },
      valueMaps: {
        aspectRatio: { "1:1": "Square · 1:1 (1024x1024)", "16:9": "Landscape · 16:9 (1344x768)", "9:16": "Portrait · 9:16 (768x1344)" },
      },
    },
  },
  {
    kind: "image",
    slug: "qwen-image-2-1-viggle",
    label: "Qwen-Image 2.1 Viggle turbo",
    type: "gradio-image",
    config: {
      space: "Viggle/Qwen-Image-2.1-viggle-turbo",
      apiName: "/generate",
      params: { prompt: "{{prompt}}", size_label: "{{aspectRatio}}", randomize_seed: true },
      valueMaps: {
        aspectRatio: { "1:1": "1:1 · 1024×1024 (1024² area)", "16:9": "16:9 · 1376×768 (1024² area)", "9:16": "9:16 · 768×1376 (1024² area)" },
      },
    },
  },
  voxcpm("voxcpm", "VoxCPM 2 (openbmb demo)", "openbmb/VoxCPM-Demo"),
  voxcpm("voxcpm2-appkh", "VoxCPM 2 (gradio-voxcpm2.appkh.online)", "https://gradio-voxcpm2.appkh.online"),
  voxcpm("voxcpm-appkh", "VoxCPM 2 (gradio-voxcmp.appkh.online)", "https://gradio-voxcmp.appkh.online/"),
];
