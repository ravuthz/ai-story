import type { ProviderKind } from "../../domain/types";
import type { AudioProvider, AudioRequest, ImageProvider, ImageRequest, VideoClip } from "../types";
import { Ffmpeg } from "../video/Ffmpeg";
import { RemoteVideoProvider } from "../video/RemoteVideoProvider";
import { McpToolClient, type McpServerConfig } from "./McpToolClient";

export interface McpProviderConfig {
  id: string;
  kind: Exclude<ProviderKind, "text">;
  label?: string;
  server: McpServerConfig;
  tool: string;
  /**
   * Tool arguments; string values may use {{placeholders}} from the request:
   * image: prompt, aspectRatio · audio: text, language, voice · video: prompt, imagePath, durationSec
   */
  arguments: Record<string, unknown>;
}

/** Replaces {{key}} placeholders; a value that is exactly one placeholder keeps its original type. */
export function renderArgs(template: Record<string, unknown>, vars: Record<string, unknown>): Record<string, unknown> {
  const render = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    const whole = value.match(/^\{\{(\w+)\}\}$/);
    if (whole) return vars[whole[1]!];
    return value.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""));
  };
  return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, render(v)]));
}

/** Shared identity/plumbing for every MCP-backed provider kind. */
class McpBinding {
  readonly client: McpToolClient;
  constructor(readonly cfg: McpProviderConfig) {
    this.client = new McpToolClient(cfg.server);
  }
  get label() {
    return this.cfg.label ?? `MCP: ${this.cfg.id}`;
  }
  call(vars: Record<string, unknown>, outPath: string) {
    return this.client.callToFile(this.cfg.tool, renderArgs(this.cfg.arguments, vars), outPath);
  }
}

export class McpImageProvider implements ImageProvider {
  readonly kind = "image" as const;
  private readonly mcp: McpBinding;
  constructor(cfg: McpProviderConfig) {
    this.mcp = new McpBinding(cfg);
  }
  get id() {
    return this.mcp.cfg.id;
  }
  get label() {
    return this.mcp.label;
  }
  dispose() {
    return this.mcp.client.close();
  }
  async isAvailable() {
    return true;
  }
  generate({ prompt, aspectRatio, outPath }: ImageRequest) {
    return this.mcp.call({ prompt, aspectRatio }, outPath);
  }
}

export class McpAudioProvider implements AudioProvider {
  readonly kind = "audio" as const;
  private readonly mcp: McpBinding;
  constructor(cfg: McpProviderConfig) {
    this.mcp = new McpBinding(cfg);
  }
  get id() {
    return this.mcp.cfg.id;
  }
  get label() {
    return this.mcp.label;
  }
  dispose() {
    return this.mcp.client.close();
  }
  async isAvailable() {
    return true;
  }
  synthesize({ text, language, voice, outPath }: AudioRequest) {
    return this.mcp.call({ text, language, voice }, outPath);
  }
}

export class McpVideoProvider extends RemoteVideoProvider {
  private readonly mcp: McpBinding;
  constructor(cfg: McpProviderConfig) {
    super();
    this.mcp = new McpBinding(cfg);
  }
  get id() {
    return this.mcp.cfg.id;
  }
  get label() {
    return this.mcp.label;
  }
  dispose() {
    return this.mcp.client.close();
  }
  isAvailable() {
    return Ffmpeg.isAvailable();
  }
  protected fetchRaw(clip: VideoClip, durationSec: number, rawPath: string) {
    return this.mcp.call({ prompt: clip.prompt, imagePath: clip.imagePath, durationSec }, rawPath);
  }
}

export function createMcpProvider(cfg: McpProviderConfig) {
  switch (cfg.kind) {
    case "image":
      return new McpImageProvider(cfg);
    case "audio":
      return new McpAudioProvider(cfg);
    case "video":
      return new McpVideoProvider(cfg);
  }
}
