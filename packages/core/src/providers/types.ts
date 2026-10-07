import type { AspectRatio, Language, MotionType, ProviderKind, VoiceMode } from "../domain/types";

export interface ProviderInfo {
  id: string;
  kind: ProviderKind;
  label: string;
  available: boolean;
  /** Extra info, e.g. the resolved CLI binary path. */
  detail?: string;
}

export interface Provider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly label: string;
  /** Optional extra info shown in provider listings. */
  readonly detail?: string;
  isAvailable(): Promise<boolean>;
  /** Releases held resources (e.g. an MCP server process) when the provider is reconfigured or removed. */
  dispose?(): Promise<void>;
}

export interface TextRequest {
  prompt: string;
  /** JSON Schema the agent should follow, when the CLI supports enforcing it. */
  jsonSchema?: object;
}
export interface TextProvider extends Provider {
  readonly kind: "text";
  complete(request: TextRequest): Promise<string>;
}

export interface ImageRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  /** Absolute output path (.png). */
  outPath: string;
}
export interface ImageProvider extends Provider {
  readonly kind: "image";
  generate(request: ImageRequest): Promise<string>;
}

export interface ResolvedVoice {
  name: string;
  mode: VoiceMode;
  /** Absolute path of the reference clip; null for a designed voice. */
  filePath: string | null;
  transcript: string;
  style: string;
}

/** Looks up a cloned voice by id (story settings.voice). */
export interface VoiceResolver {
  resolve(id: string | undefined): ResolvedVoice | null;
}

export interface AudioRequest {
  text: string;
  language: Language;
  voice?: string;
  /** The kind of custom voice the story asked for; a voice of the other kind is refused. */
  voiceMode?: VoiceMode;
  /** Voice design text (voiceMode "design"); blank = the provider's default description. */
  voiceDescription?: string;
  /** Absolute output path (.mp3/.wav). */
  outPath: string;
}
export interface AudioProvider extends Provider {
  readonly kind: "audio";
  synthesize(request: AudioRequest): Promise<string>;
}

export interface VideoClip {
  imagePath: string;
  audioPath?: string | null;
  durationSec: number;
  motion: MotionType;
  prompt?: string;
}
export interface VideoClipRequest {
  clip: VideoClip;
  aspectRatio: AspectRatio;
  outPath: string;
}
export interface VideoProvider extends Provider {
  readonly kind: "video";
  /** Renders one motion clip for a scene (image + optional narration). */
  renderClip(request: VideoClipRequest): Promise<string>;
}

export type AnyProvider = TextProvider | ImageProvider | AudioProvider | VideoProvider;

export interface ProviderByKind {
  text: TextProvider;
  image: ImageProvider;
  audio: AudioProvider;
  video: VideoProvider;
}
