import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");

/** Expands a leading "~/" like a shell would. */
export const expandHome = (value: string): string => value.replace(/^~(?=\/|$)/, homedir());

/** Loads <repo>/.env regardless of cwd (MCP clients spawn us from anywhere). Real env vars win. */
function loadRootEnv(): void {
  const file = resolve(root, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, raw] = match as unknown as [string, string, string];
    const value = raw.replace(/^["']|["']$/g, "");
    // Real env vars win; a value equal to the file's means Bun already auto-loaded this .env.
    const current = process.env[key];
    if (current !== undefined && current !== value) continue;
    // Expand a leading "~/" like a shell would (also for pass-through vars such as CODEX_HOME).
    process.env[key] = expandHome(value);
  }
}
loadRootEnv();

const env = (key: string, fallback = ""): string => process.env[key]?.trim() || fallback;
const num = (key: string, fallback: number): number => Number(env(key)) || fallback;

export const AGENT_IDS = ["codex", "claude", "gemini", "agy", "omp"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export interface AgentSettings {
  /** Executable name or absolute path (<ID>_BIN); defaults to the id looked up on PATH. */
  bin: string;
  /** Optional model override (<ID>_MODEL); blank = the CLI's own config. */
  model: string;
  /** Extra PATH folders (shared AGENT_PATH). */
  extraPath?: string[];
}

/** Reads CODEX_BIN / CODEX_MODEL, CLAUDE_BIN / CLAUDE_MODEL, ... for every agent CLI. */
const agentSettings = (): Record<AgentId, AgentSettings> =>
  Object.fromEntries(
    AGENT_IDS.map((id) => {
      const key = id.toUpperCase();
      return [id, { bin: env(`${key}_BIN`) || id, model: env(`${key}_MODEL`), extraPath: env("AGENT_PATH").split(":").filter(Boolean).map(expandHome) }];
    }),
  ) as Record<AgentId, AgentSettings>;

export const config = {
  port: num("PORT", 3001),
  storageDir: resolve(root, env("STORAGE_DIR", "storage")),
  databasePath: resolve(root, env("DATABASE_PATH", "storage/ai-story.sqlite")),
  cliTimeoutMs: num("CLI_TIMEOUT_MS", 600_000),
  workerConcurrency: num("WORKER_CONCURRENCY", 2),
  defaults: {
    text: env("DEFAULT_TEXT_PROVIDER", "codex"),
    image: env("DEFAULT_IMAGE_PROVIDER", "qwen"),
    audio: env("DEFAULT_AUDIO_PROVIDER", "edge"),
    video: env("DEFAULT_VIDEO_PROVIDER", "ffmpeg"),
  },
  agents: agentSettings(),
  gemini: {
    apiKey: env("GEMINI_API_KEY"),
    imageModel: env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"),
    ttsModel: env("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts"),
  },
  qwen: {
    url: env("QWEN_GRADIO_URL", "Qwen/Qwen-Image"),
    endpoint: env("QWEN_GRADIO_ENDPOINT", "/infer"),
  },
  videoGradio: {
    url: env("VIDEO_GRADIO_URL"),
    endpoint: env("VIDEO_GRADIO_ENDPOINT", "/generate_video"),
  },
  hfToken: env("HF_TOKEN"),
} as const;

export type AppConfig = typeof config;
