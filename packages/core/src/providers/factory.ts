import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "../config";
import { EdgeTtsProvider } from "./audio/EdgeTtsProvider";
import { GeminiTtsProvider } from "./audio/GeminiTtsProvider";
import { createAgents } from "./cli/agents";
import { GeminiApi } from "./GeminiApi";
import { GradioApi } from "./GradioApi";
import { CodexImageProvider } from "./image/CodexImageProvider";
import { GeminiImageProvider } from "./image/GeminiImageProvider";
import { QwenGradioImageProvider } from "./image/QwenGradioImageProvider";
import { createMcpProvider, type McpProviderConfig } from "./mcp/McpProviders";
import { ProviderRegistry } from "./ProviderRegistry";
import { AgentTextProvider } from "./text/AgentTextProvider";
import { FfmpegMotionVideoProvider } from "./video/FfmpegMotionVideoProvider";
import { GradioVideoProvider } from "./video/GradioVideoProvider";

export class ProviderFactory {
  static readonly MCP_CONFIG_FILE = "providers.config.json";

  static registry(config: AppConfig): ProviderRegistry {
    const registry = new ProviderRegistry(config.defaults);
    const agents = createAgents(config.cliTimeoutMs, config.agents);
    const gemini = new GeminiApi(config.gemini.apiKey);
    const codex = agents.find((a) => a.id === "codex")!;

    registry.register(
      ...agents.map((agent) => new AgentTextProvider(agent)),
      new CodexImageProvider(codex),
      new QwenGradioImageProvider(new GradioApi(config.qwen.url, config.hfToken), config.qwen.endpoint),
      new GeminiImageProvider(gemini, config.gemini.imageModel),
      new EdgeTtsProvider(),
      new GeminiTtsProvider(gemini, config.gemini.ttsModel),
      new FfmpegMotionVideoProvider(),
      new GradioVideoProvider(new GradioApi(config.videoGradio.url, config.hfToken), config.videoGradio.endpoint),
      ...ProviderFactory.loadMcpConfigs(resolve(config.storageDir, "..", ProviderFactory.MCP_CONFIG_FILE)).map(createMcpProvider),
    );
    return registry;
  }

  /** Optional user-defined MCP media providers: { "mcp": McpProviderConfig[] }. */
  private static loadMcpConfigs(path: string): McpProviderConfig[] {
    if (!existsSync(path)) return [];
    return (JSON.parse(readFileSync(path, "utf8")) as { mcp?: McpProviderConfig[] }).mcp ?? [];
  }
}
