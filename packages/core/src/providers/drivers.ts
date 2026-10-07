import { expandHome, type AgentId } from "../config";
import { InputError } from "../db/repositories/BaseRepository";
import type { ProviderKind } from "../domain/types";
import { EdgeTtsProvider } from "./audio/EdgeTtsProvider";
import { GeminiTtsProvider } from "./audio/GeminiTtsProvider";
import { AGENT_CLASSES } from "./cli/agents";
import { GeminiApi } from "./GeminiApi";
import { GRADIO_PLACEHOLDERS, GradioAudioProvider, type GradioConnection, type GradioProviderConfig, GradioImageProvider, GradioTextProvider, GradioVideoProvider } from "./gradio/GradioProviders";
import { CodexImageProvider } from "./image/CodexImageProvider";
import { GeminiImageProvider } from "./image/GeminiImageProvider";
import { createMcpProvider, type McpProviderConfig } from "./mcp/McpProviders";
import { AgentTextProvider } from "./text/AgentTextProvider";
import type { AnyProvider, VoiceResolver } from "./types";
import { FfmpegMotionVideoProvider } from "./video/FfmpegMotionVideoProvider";

export interface DriverField {
  key: string;
  label: string;
  /**
   * text/secret: string · number · json: object (edited as JSON) · list: string[] (edited as ":"-separated text)
   * · connections: ordered GradioConnection[] (own editor).
   */
  type: "text" | "secret" | "number" | "json" | "list" | "connections";
  /** Stored and validated like the others but edited elsewhere (not shown in the provider form). */
  hidden?: boolean;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export interface DriverContext {
  cliTimeoutMs: number;
  /** Cloned voices, for providers that take a reference clip. */
  voices?: VoiceResolver;
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
    {
      key: "connections",
      label: "Connections",
      type: "connections",
      required: true,
      hint: `Tried in order; if one fails the next is used. Placeholders: ${GRADIO_PLACEHOLDERS[kind].map((p) => `{{${p}}}`).join(" ")}`,
    },
    { ...HF_TOKEN, hint: "Sent only to Hugging Face spaces" },
    { key: "timeoutSec", label: "Timeout per connection (sec)", type: "number", placeholder: "300", hint: "Move on to the next connection after this long" },
    ...(kind === "video" ? [{ key: "maxDurationSec", label: "Max clip seconds", type: "number" as const, hint: "Optional; shorter clips are looped to the scene length" }] : []),
    // Set from the voices dialog: { mode: "clone", voiceId } or { mode: "design", description }.
    ...(kind === "audio" ? [{ key: "defaultVoice", label: "Default voice", type: "json" as const, hidden: true }] : []),
  ],
  create: (c, ctx) =>
    new GRADIO_CLASSES[kind](
      {
      connections: Array.isArray(c.connections) ? (c.connections as GradioConnection[]) : [],
      hfToken: str(c, "hfToken"),
      timeoutSec: num(c, "timeoutSec"),
      maxDurationSec: num(c, "maxDurationSec"),
      defaultVoice: obj(c, "defaultVoice") as GradioProviderConfig["defaultVoice"],
      },
      ctx.voices,
    ),
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
