import { mkdir, rm } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { InputError } from "../db/repositories/BaseRepository";
import type { ProviderRepository } from "../db/repositories/ProviderRepository";
import type { VoiceRepository } from "../db/repositories/VoiceRepository";
import type { VoiceInput } from "../domain/schemas";
import type { Language, Voice } from "../domain/types";
import { EdgeTtsProvider } from "../providers/audio/EdgeTtsProvider";
import { GeminiTtsProvider } from "../providers/audio/GeminiTtsProvider";
import type { ProviderRegistry } from "../providers/ProviderRegistry";
import type { ResolvedVoice, VoiceResolver } from "../providers/types";
import type { ProjectStorage } from "../storage/ProjectStorage";
import { newId, nowIso } from "../utils/text";

/** Provider types whose voices are user-uploaded reference clips. */
export const CLONING_TYPES = new Set(["gradio-audio"]);
const AUDIO_EXT = new Set([".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm", ".aac"]);
const MAX_BYTES = 20 * 1024 * 1024;
/** Outside any project folder: project slugs never start with "_". */
const VOICE_DIR = "_voices";

export interface VoiceOption {
  value: string;
  label: string;
}

/** Cloned voices (reference audio + optional transcript/style) owned by a provider, plus voice choices per provider. */
export class VoiceService implements VoiceResolver {
  constructor(
    private readonly repo: VoiceRepository,
    private readonly providers: ProviderRepository,
    private readonly registry: ProviderRegistry,
    private readonly storage: ProjectStorage,
  ) {}

  list(providerId: string): Voice[] {
    this.providers.getById(providerId);
    return this.repo.listByProvider(providerId);
  }

  async create(providerId: string, input: VoiceInput, file: File | undefined): Promise<Voice> {
    const provider = this.providers.getById(providerId);
    if (!CLONING_TYPES.has(provider.type)) throw new InputError(`${provider.label} does not support cloned voices`);
    if (!file) throw new InputError("A reference audio file is required");
    const id = newId();
    const filePath = await this.saveFile(id, file);
    return this.repo.insert({
      id,
      providerId,
      name: input.name.trim(),
      filePath,
      transcript: input.transcript?.trim() ?? "",
      style: input.style?.trim() ?? "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  /** Updates the fields present in `input`; a new file replaces the reference audio. */
  async update(id: string, input: Partial<VoiceInput>, file?: File): Promise<Voice> {
    const current = this.repo.getById(id);
    const filePath = file ? await this.saveFile(id, file) : current.filePath;
    if (file && filePath !== current.filePath) await this.removeFile(current.filePath);
    return this.repo.update(id, {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.transcript !== undefined && { transcript: input.transcript.trim() }),
      ...(input.style !== undefined && { style: input.style.trim() }),
      filePath,
      updatedAt: nowIso(),
    });
  }

  async delete(id: string): Promise<void> {
    const voice = this.repo.getById(id);
    this.repo.delete(id);
    await this.removeFile(voice.filePath);
  }

  /** Removes a provider's voice files; the rows go with the provider (ON DELETE CASCADE). */
  async removeFilesForProvider(providerId: string): Promise<void> {
    await Promise.all(this.repo.listByProvider(providerId).map((v) => this.removeFile(v.filePath)));
  }

  resolve(id: string | undefined): ResolvedVoice | null {
    const voice = id ? this.repo.findById(id) : null;
    return voice ? { name: voice.name, filePath: this.storage.toAbsolute(voice.filePath), transcript: voice.transcript, style: voice.style } : null;
  }

  /** Voice choices for a story: the given audio provider (or the default one) decides what a voice is. */
  options(audioSlug: string | undefined, language: Language): { providerId: string | null; cloning: boolean; voices: VoiceOption[] } {
    const slug = audioSlug || this.registry.defaults.audio;
    const record = slug ? this.providers.findBySlug("audio", slug) : null;
    if (!record) return { providerId: null, cloning: false, voices: [] };
    const named = (names: string[]) => names.map((v) => ({ value: v, label: v }));
    const voices =
      record.type === "edge-tts"
        ? named(EdgeTtsProvider.VOICES[language])
        : record.type === "gemini-tts"
          ? named(GeminiTtsProvider.VOICES)
          : CLONING_TYPES.has(record.type)
            ? this.repo.listByProvider(record.id).map((v) => ({ value: v.id, label: v.name }))
            : [];
    return { providerId: record.id, cloning: CLONING_TYPES.has(record.type), voices };
  }

  private async saveFile(id: string, file: File): Promise<string> {
    const ext = (extname(file.name) || ".wav").toLowerCase();
    if (!AUDIO_EXT.has(ext)) throw new InputError(`Unsupported audio type ${ext}; use ${[...AUDIO_EXT].join(", ")}`);
    if (file.size > MAX_BYTES) throw new InputError("Reference audio must be 20 MB or smaller");
    if (!file.size) throw new InputError("Reference audio is empty");
    const abs = this.storage.toAbsolute(`${VOICE_DIR}/${id}${ext}`);
    await mkdir(dirname(abs), { recursive: true });
    await Bun.write(abs, file);
    return this.storage.toRelative(abs);
  }

  private removeFile(stored: string) {
    return rm(this.storage.toAbsolute(stored), { force: true });
  }
}
