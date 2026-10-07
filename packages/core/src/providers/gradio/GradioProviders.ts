import type { ProviderKind } from "../../domain/types";
import { DIMENSIONS } from "../../utils/media";
import { GradioApi } from "../GradioApi";
import { renderArgs } from "../mcp/McpProviders";
import type { AudioProvider, AudioRequest, ImageProvider, ImageRequest, TextProvider, TextRequest, VideoClip } from "../types";
import { Ffmpeg } from "../video/Ffmpeg";
import { RemoteVideoProvider } from "../video/RemoteVideoProvider";

/**
 * One Gradio endpoint, called with named parameters. `space` is an HF Space id
 * ("owner/name"), a remote URL, or a local app ("http://127.0.0.1:7860").
 */
export interface GradioProviderConfig {
  space: string;
  apiName: string;
  hfToken?: string;
  /** Named endpoint parameters; string values may use {{placeholders}} from the request. */
  params: Record<string, unknown>;
  /** Per-placeholder value translation, e.g. { "aspectRatio": { "9:16": "Portrait · 9:16 (768x1344)" } }. */
  valueMaps?: Record<string, Record<string, unknown>>;
  /** Video only: longest clip to request; the clip is looped locally to the scene length. */
  maxDurationSec?: number;
}

/** Placeholders each kind fills in; shown as the params hint in the UI. */
export const GRADIO_PLACEHOLDERS: Record<ProviderKind, string[]> = {
  text: ["prompt"],
  image: ["prompt", "aspectRatio", "width", "height", "seed"],
  audio: ["text", "language", "voice"],
  video: ["prompt", "imagePath", "durationSec", "seed"],
};

const randomSeed = () => Math.floor(Math.random() * 2_147_483_647);

/** Shared plumbing: maps request values, renders params and calls the endpoint. */
class GradioBinding {
  readonly api: GradioApi;
  constructor(readonly cfg: GradioProviderConfig) {
    this.api = new GradioApi(cfg.space, cfg.hfToken);
  }
  call(vars: Record<string, unknown>) {
    const mapped = Object.fromEntries(
      Object.entries(vars).map(([k, v]) => {
        const map = this.cfg.valueMaps?.[k];
        return [k, map && typeof v === "string" && v in map ? map[v] : v];
      }),
    );
    return this.api.predict(this.cfg.apiName, renderArgs(this.cfg.params, mapped));
  }
}

abstract class GradioProvider {
  readonly id: string = "gradio";
  readonly label: string = "Gradio";
  protected readonly gradio: GradioBinding;
  constructor(cfg: GradioProviderConfig) {
    this.gradio = new GradioBinding(cfg);
  }
  get detail() {
    return `${this.gradio.cfg.space} · ${this.gradio.cfg.apiName}`;
  }
  async isAvailable() {
    return this.gradio.api.configured;
  }
}

export class GradioTextProvider extends GradioProvider implements TextProvider {
  readonly kind = "text" as const;
  async complete({ prompt }: TextRequest): Promise<string> {
    const data = await this.gradio.call({ prompt });
    const text = data.find((v) => typeof v === "string");
    if (text === undefined) throw new Error(`Gradio ${this.gradio.cfg.space} returned no text`);
    return text as string;
  }
}

export class GradioImageProvider extends GradioProvider implements ImageProvider {
  readonly kind = "image" as const;
  async generate({ prompt, aspectRatio, outPath }: ImageRequest): Promise<string> {
    const { width, height } = DIMENSIONS[aspectRatio];
    const data = await this.gradio.call({ prompt, aspectRatio, width, height, seed: randomSeed() });
    return this.gradio.api.saveFirstFile(data, outPath);
  }
}

export class GradioAudioProvider extends GradioProvider implements AudioProvider {
  readonly kind = "audio" as const;
  async synthesize({ text, language, voice, outPath }: AudioRequest): Promise<string> {
    const data = await this.gradio.call({ text, language, voice });
    // TTS spaces usually return .wav/.flac; keep that extension instead of the requested .mp3.
    return this.gradio.api.saveFirstFile(data, outPath, { keepExtension: true });
  }
}

export class GradioVideoProvider extends RemoteVideoProvider {
  readonly id: string = "gradio";
  readonly label: string = "Gradio";
  private readonly gradio: GradioBinding;
  constructor(cfg: GradioProviderConfig) {
    super();
    this.gradio = new GradioBinding(cfg);
  }
  get detail() {
    return `${this.gradio.cfg.space} · ${this.gradio.cfg.apiName}`;
  }
  async isAvailable() {
    return this.gradio.api.configured && (await Ffmpeg.isAvailable());
  }
  protected async fetchRaw(clip: VideoClip, durationSec: number, rawPath: string): Promise<string> {
    const max = this.gradio.cfg.maxDurationSec;
    const data = await this.gradio.call({
      prompt: clip.prompt ?? "subtle cinematic camera motion",
      imagePath: GradioApi.file(clip.imagePath),
      durationSec: max ? Math.min(durationSec, max) : durationSec,
      seed: randomSeed(),
    });
    return this.gradio.api.saveFirstFile(data, rawPath);
  }
}
