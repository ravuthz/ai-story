import type { ProviderKind } from "../../domain/types";
import { DIMENSIONS } from "../../utils/media";
import { GradioApi } from "../GradioApi";
import { renderArgs } from "../mcp/McpProviders";
import type { AudioProvider, AudioRequest, ImageProvider, ImageRequest, TextProvider, TextRequest, VideoClip, VoiceResolver } from "../types";
import { Ffmpeg } from "../video/Ffmpeg";
import { RemoteVideoProvider } from "../video/RemoteVideoProvider";

/**
 * One Gradio endpoint, called with named parameters. `space` is an HF Space id
 * ("owner/name"), a remote URL, or a local app ("http://127.0.0.1:7860").
 */
export interface GradioConnection {
  space: string;
  apiName: string;
  /** Named endpoint parameters; string values may use {{placeholders}} from the request. */
  params: Record<string, unknown>;
  /** Per-placeholder value translation, e.g. { "aspectRatio": { "9:16": "Portrait · 9:16 (768x1344)" } }. */
  valueMaps?: Record<string, Record<string, unknown>>;
  /** Skipped when false. */
  enabled?: boolean;
  /** Notes kept with the connection; never sent. */
  meta?: Record<string, unknown>;
}

export interface GradioProviderConfig {
  /** Tried in order; a failing connection falls through to the next one. */
  connections: GradioConnection[];
  /** Hugging Face token, used only for Hugging Face spaces. */
  hfToken?: string;
  /** Give up on a connection after this long and try the next one. */
  timeoutSec?: number;
  /** Video only: longest clip to request; the clip is looped locally to the scene length. */
  maxDurationSec?: number;
}

/** Placeholders each kind fills in; shown as the params hint in the UI. */
export const GRADIO_PLACEHOLDERS: Record<ProviderKind, string[]> = {
  text: ["prompt"],
  image: ["prompt", "aspectRatio", "width", "height", "seed"],
  audio: ["text", "language", "voice", "voiceFile", "voiceTranscript", "useTranscript", "voiceStyle"],
  video: ["prompt", "imagePath", "durationSec", "seed"],
};

const randomSeed = () => Math.floor(Math.random() * 2_147_483_647);

const withTimeout = <T>(promise: Promise<T>, sec: number | undefined, what: string): Promise<T> =>
  !sec
    ? promise
    : Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${sec}s`)), sec * 1000))]);

/** Ordered connections with fallback: the first one that returns a usable result wins. */
class GradioPool {
  private readonly targets: { conn: GradioConnection; api: GradioApi }[];

  constructor(readonly cfg: GradioProviderConfig) {
    this.targets = cfg.connections.filter((c) => c.enabled !== false && c.space).map((conn) => ({ conn, api: new GradioApi(conn.space, cfg.hfToken) }));
  }

  get configured() {
    return this.targets.length > 0;
  }

  get detail() {
    const [first, ...rest] = this.targets;
    return first ? `${first.conn.space} · ${first.conn.apiName}${rest.length ? ` (+${rest.length} fallback)` : ""}` : "no enabled connection";
  }

  /** Calls each connection in order; `handle` (e.g. saving the file) is part of the attempt, so its failure also falls through. */
  async run<T>(vars: Record<string, unknown>, handle: (data: unknown[], api: GradioApi) => Promise<T>): Promise<T> {
    if (!this.targets.length) throw new Error("Gradio provider has no enabled connection");
    const errors: string[] = [];
    for (const { conn, api } of this.targets) {
      try {
        const data = await withTimeout(api.predict(conn.apiName, renderArgs(conn.params, GradioPool.mapValues(conn, vars))), this.cfg.timeoutSec, conn.space);
        return await handle(data, api);
      } catch (error) {
        const message = (error as Error).message?.replace(/\s+/g, " ").slice(0, 200) || String(error);
        errors.push(`${conn.space}: ${message}`);
        console.warn(`Gradio ${conn.space} ${conn.apiName} failed, trying next connection: ${message}`);
      }
    }
    throw new Error(`All Gradio connections failed:\n${errors.join("\n")}`);
  }

  private static mapValues(conn: GradioConnection, vars: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(vars).map(([k, v]) => {
        const map = conn.valueMaps?.[k];
        return [k, map && typeof v === "string" && v in map ? map[v] : v];
      }),
    );
  }
}

abstract class GradioProvider {
  readonly id: string = "gradio";
  readonly label: string = "Gradio";
  protected readonly pool: GradioPool;
  constructor(
    cfg: GradioProviderConfig,
    protected readonly voices?: VoiceResolver,
  ) {
    this.pool = new GradioPool(cfg);
  }
  get detail() {
    return this.pool.detail;
  }
  async isAvailable() {
    return this.pool.configured;
  }
}

export class GradioTextProvider extends GradioProvider implements TextProvider {
  readonly kind = "text" as const;
  complete({ prompt }: TextRequest): Promise<string> {
    return this.pool.run({ prompt }, async (data) => {
      const text = data.find((v) => typeof v === "string");
      if (text === undefined) throw new Error("returned no text");
      return text as string;
    });
  }
}

export class GradioImageProvider extends GradioProvider implements ImageProvider {
  readonly kind = "image" as const;
  generate({ prompt, aspectRatio, outPath }: ImageRequest): Promise<string> {
    const { width, height } = DIMENSIONS[aspectRatio];
    return this.pool.run({ prompt, aspectRatio, width, height, seed: randomSeed() }, (data, api) => api.saveFirstFile(data, outPath));
  }
}

export class GradioAudioProvider extends GradioProvider implements AudioProvider {
  readonly kind = "audio" as const;
  synthesize({ text, language, voice, outPath }: AudioRequest): Promise<string> {
    // A cloned voice fills {{voiceFile}} / {{voiceTranscript}} / {{useTranscript}} / {{voiceStyle}}; none = the app's default voice.
    const cloned = this.voices?.resolve(voice);
    if (voice && !cloned) console.warn(`Voice "${voice}" not found; using the default voice`);
    const vars = {
      text,
      language,
      voice: cloned?.name ?? voice,
      voiceFile: cloned ? GradioApi.file(cloned.filePath) : null,
      voiceTranscript: cloned?.transcript ?? "",
      useTranscript: !!cloned?.transcript,
      voiceStyle: cloned?.style ?? "",
    };
    // TTS spaces usually return .wav/.flac; keep that extension instead of the requested .mp3.
    return this.pool.run(vars, (data, api) => api.saveFirstFile(data, outPath, { keepExtension: true }));
  }
}

export class GradioVideoProvider extends RemoteVideoProvider {
  readonly id: string = "gradio";
  readonly label: string = "Gradio";
  private readonly pool: GradioPool;
  constructor(cfg: GradioProviderConfig, _voices?: VoiceResolver) {
    super();
    this.pool = new GradioPool(cfg);
  }
  get detail() {
    return this.pool.detail;
  }
  async isAvailable() {
    return this.pool.configured && (await Ffmpeg.isAvailable());
  }
  protected fetchRaw(clip: VideoClip, durationSec: number, rawPath: string): Promise<string> {
    const max = this.pool.cfg.maxDurationSec;
    const vars = {
      prompt: clip.prompt ?? "subtle cinematic camera motion",
      imagePath: GradioApi.file(clip.imagePath),
      durationSec: max ? Math.min(durationSec, max) : durationSec,
      seed: randomSeed(),
    };
    return this.pool.run(vars, (data, api) => api.saveFirstFile(data, rawPath));
  }
}
