import { expandHome, type AgentId } from "../config";
import { InputError } from "../db/repositories/BaseRepository";
import type { ProviderKind } from "../domain/types";
import { EdgeTtsProvider } from "./audio/EdgeTtsProvider";
import { GeminiTtsProvider } from "./audio/GeminiTtsProvider";
import { AGENT_CLASSES } from "./cli/agents";
import { GeminiApi } from "./GeminiApi";
import { GRADIO_PLACEHOLDERS, GradioAudioProvider, GradioImageProvider, GradioTextProvider, GradioVideoProvider } from "./gradio/GradioProviders";
import { CodexImageProvider } from "./image/CodexImageProvider";
import { GeminiImageProvider } from "./image/GeminiImageProvider";
import { createMcpProvider, type McpProviderConfig } from "./mcp/McpProviders";
import { AgentTextProvider } from "./text/AgentTextProvider";
import type { AnyProvider } from "./types";
import { FfmpegMotionVideoProvider } from "./video/FfmpegMotionVideoProvider";

export interface DriverField {
  key: string;
  label: string;
  /** text/secret: string · number · json: object (edited as JSON) · list: string[] (edited as ":"-separated text). */
  type: "text" | "secret" | "number" | "json" | "list";
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export interface DriverContext {
  cliTimeoutMs: number;
}

/** Knows how to build one provider class from a stored config; also describes that config for the UI. */
export interface ProviderDriver {
  type: string;
  kind: ProviderKind;
  label: string;
  description: string;
  fields: DriverField[];
  create(config: Record<string, unknown>, ctx: DriverContext): AnyProvider;
}

export type ProviderDriverInfo = Omit<ProviderDriver, "create">;

const str = (c: Record<string, unknown>, key: string, fallback = ""): string => (typeof c[key] === "string" && (c[key] as string).trim()) || fallback;
const list = (c: Record<string, unknown>, key: string): string[] => (Array.isArray(c[key]) ? (c[key] as string[]) : []);
const obj = (c: Record<string, unknown>, key: string): Record<string, unknown> =>
  c[key] && typeof c[key] === "object" && !Array.isArray(c[key]) ? (c[key] as Record<string, unknown>) : {};

const AGENT_FIELDS: DriverField[] = [
  { key: "bin", label: "Executable", type: "text", placeholder: "/opt/homebrew/bin/codex", hint: "Name on PATH or absolute path (~/ allowed)" },
  { key: "model", label: "Model", type: "text", hint: "Blank = the CLI's own config" },
  { key: "extraPath", label: "Extra PATH folders", type: "list", placeholder: "/opt/homebrew/bin:~/.bun/bin", hint: "Colon-separated" },
];
const API_KEY: DriverField = { key: "apiKey", label: "API key", type: "secret", required: true };
const HF_TOKEN: DriverField = { key: "hfToken", label: "Hugging Face token", type: "secret" };
const MCP_FIELDS: DriverField[] = [
  { key: "server", label: "Server", type: "json", required: true, placeholder: '{ "command": "npx", "args": ["-y", "some-mcp"] }', hint: 'stdio { command, args, env } or remote { url }' },
  { key: "tool", label: "Tool name", type: "text", required: true },
  { key: "arguments", label: "Tool arguments", type: "json", placeholder: '{ "prompt": "{{prompt}}" }', hint: "Values may use {{placeholders}} from the request" },
];

const num = (c: Record<string, unknown>, key: string): number | undefined => (typeof c[key] === "number" ? (c[key] as number) : undefined);

const GRADIO_CLASSES = { text: GradioTextProvider, image: GradioImageProvider, audio: GradioAudioProvider, video: GradioVideoProvider };

/** Any Gradio app — HF Space, remote URL or local server — called with templated named parameters. */
const gradioDriver = (kind: ProviderKind): ProviderDriver => ({
  type: `gradio-${kind}`,
  kind,
  label: `Gradio ${kind}`,
  description: `Any Gradio app that returns ${kind === "text" ? "text" : `a ${kind} file`}: an HF Space id, a remote URL or a local server.`,
  fields: [
    { key: "space", label: "Gradio space / URL", type: "text", required: true, placeholder: "owner/space  ·  https://…  ·  http://127.0.0.1:7860" },
    { key: "apiName", label: "API name", type: "text", required: true, placeholder: "/generate" },
    HF_TOKEN,
    {
      key: "params",
      label: "Parameters",
      type: "json",
      required: true,
      placeholder: `{ "${kind === "audio" ? "text_input" : "prompt"}": "{{${kind === "audio" ? "text" : "prompt"}}}" }`,
      hint: `Named endpoint parameters. Placeholders: ${GRADIO_PLACEHOLDERS[kind].map((p) => `{{${p}}}`).join(" ")}`,
    },
    {
      key: "valueMaps",
      label: "Value maps",
      type: "json",
      placeholder: '{ "aspectRatio": { "9:16": "Portrait · 9:16 (768x1344)" } }',
      hint: "Optional: translate a placeholder's value into what this app expects",
    },
    ...(kind === "video" ? [{ key: "maxDurationSec", label: "Max clip seconds", type: "number" as const, hint: "Optional; shorter clips are looped to the scene length" }] : []),
    { key: "meta", label: "Extra settings", type: "json", hint: "Optional notes kept with the provider; not sent to the app" },
  ],
  create: (c) =>
    new GRADIO_CLASSES[kind]({
      space: str(c, "space"),
      apiName: str(c, "apiName", "/predict"),
      hfToken: str(c, "hfToken"),
      params: obj(c, "params"),
      valueMaps: obj(c, "valueMaps") as Record<string, Record<string, unknown>>,
      maxDurationSec: num(c, "maxDurationSec"),
    }),
});

const agentSettings = (id: AgentId, c: Record<string, unknown>) => ({
  bin: expandHome(str(c, "bin", id)),
  model: str(c, "model"),
  extraPath: list(c, "extraPath").map(expandHome),
});

const agentDriver = (id: AgentId, label: string): ProviderDriver => ({
  type: `${id}-cli`,
  kind: "text",
  label,
  description: `Headless ${label} writes the story script.`,
  fields: AGENT_FIELDS,
  create: (c, ctx) => new AgentTextProvider(new AGENT_CLASSES[id](ctx.cliTimeoutMs, agentSettings(id, c))),
});

const mcpDriver = (kind: McpProviderConfig["kind"]): ProviderDriver => ({
  type: `mcp-${kind}`,
  kind,
  label: `MCP ${kind} tool`,
  description: `Any MCP tool that returns ${kind} (inline, URL or file path).`,
  fields: MCP_FIELDS,
  create: (c) => createMcpProvider({ id: "", kind, server: obj(c, "server"), tool: str(c, "tool"), arguments: obj(c, "arguments") }),
});

export const PROVIDER_DRIVERS: ProviderDriver[] = [
  agentDriver("codex", "OpenAI Codex CLI"),
  agentDriver("claude", "Claude Code CLI"),
  agentDriver("gemini", "Google Gemini CLI"),
  agentDriver("agy", "Antigravity CLI"),
  agentDriver("omp", "Oh My Pi (omp)"),
  {
    type: "codex-image",
    kind: "image",
    label: "Codex CLI (local)",
    description: "Codex CLI's built-in image generation tool.",
    fields: AGENT_FIELDS,
    create: (c, ctx) => new CodexImageProvider(new AGENT_CLASSES.codex(ctx.cliTimeoutMs, agentSettings("codex", c))),
  },
  {
    type: "gemini-image",
    kind: "image",
    label: "Gemini (Nano Banana)",
    description: "Gemini image generation API.",
    fields: [API_KEY, { key: "model", label: "Model", type: "text", placeholder: "gemini-2.5-flash-image" }],
    create: (c) => new GeminiImageProvider(new GeminiApi(str(c, "apiKey")), str(c, "model", "gemini-2.5-flash-image")),
  },
  {
    type: "edge-tts",
    kind: "audio",
    label: "Edge TTS",
    description: "Free Microsoft Edge neural voices, including native Khmer.",
    fields: [],
    create: () => new EdgeTtsProvider(),
  },
  {
    type: "gemini-tts",
    kind: "audio",
    label: "Gemini TTS",
    description: "Gemini text-to-speech API.",
    fields: [API_KEY, { key: "model", label: "Model", type: "text", placeholder: "gemini-2.5-flash-preview-tts" }],
    create: (c) => new GeminiTtsProvider(new GeminiApi(str(c, "apiKey")), str(c, "model", "gemini-2.5-flash-preview-tts")),
  },
  {
    type: "ffmpeg-motion",
    kind: "video",
    label: "FFmpeg motion (Ken Burns)",
    description: "Local pan/zoom motion from the still image.",
    fields: [],
    create: () => new FfmpegMotionVideoProvider(),
  },
  gradioDriver("text"),
  gradioDriver("image"),
  gradioDriver("audio"),
  gradioDriver("video"),
  mcpDriver("image"),
  mcpDriver("audio"),
  mcpDriver("video"),
];

const BY_TYPE = new Map(PROVIDER_DRIVERS.map((d) => [d.type, d]));

export function getDriver(type: string): ProviderDriver {
  const driver = BY_TYPE.get(type);
  if (!driver) throw new InputError(`Unknown provider type "${type}". Known: ${[...BY_TYPE.keys()].join(", ")}`);
  return driver;
}
