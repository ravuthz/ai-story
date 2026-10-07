import { mkdir, readdir, rm } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { InputError } from "../db/repositories/BaseRepository";
import type { ProviderRepository } from "../db/repositories/ProviderRepository";
import type { VoiceRepository } from "../db/repositories/VoiceRepository";
import type { DefaultVoice, VoiceInput } from "../domain/schemas";
import type { Language, Voice, VoiceMode } from "../domain/types";
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
  /** Set for custom voices, so the story can filter cloned vs designed. */
  mode?: VoiceMode;
}

/** Custom voices owned by a provider (cloned from a clip, or designed from a description), plus voice choices per provider. */
export class VoiceService implements VoiceResolver {
  constructor(
    private readonly repo: VoiceRepository,
    private readonly providers: ProviderRepository,
    private readonly registry: ProviderRegistry,
    private readonly storage: ProjectStorage,
  ) {}

  get(id: string): Voice {
    return this.repo.getById(id);
  }

  list(providerId: string): Voice[] {
    this.providers.getById(providerId);
    return this.repo.listByProvider(providerId);
  }

  async create(providerId: string, input: VoiceInput, file: File | undefined): Promise<Voice> {
    const provider = this.providers.getById(providerId);
    if (!CLONING_TYPES.has(provider.type)) throw new InputError(`${provider.label} does not support custom voices`);
    const mode = input.mode ?? "clone";
    VoiceService.check(mode, { hasFile: !!file, style: input.style });
    const id = newId();
    const filePath = mode === "clone" ? await this.saveFile(id, file!) : null;
    return this.repo.insert({
      id,
      providerId,
      name: input.name.trim(),
      mode,
      filePath,
      transcript: input.transcript?.trim() ?? "",
      style: input.style?.trim() ?? "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  /**
   * Updates the fields present in `input`; a new file replaces the reference audio.
   * Switching to "design" drops the clip; switching to "clone" needs a file.
   */
  async update(id: string, input: Partial<VoiceInput>, file?: File): Promise<Voice> {
    const current = this.repo.getById(id);
    const mode = input.mode ?? current.mode;
    VoiceService.check(mode, { hasFile: !!file || !!current.filePath, style: input.style ?? current.style });
    let filePath = current.filePath;
    if (mode === "design") filePath = null;
    else if (file) filePath = await this.saveFile(id, file);
    if (current.filePath && filePath !== current.filePath) await this.removeFile(current.filePath);
    return this.repo.update(id, {
      mode,
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
    if (voice.filePath) await this.removeFile(voice.filePath);
  }

  /** Removes a provider's voice files; the rows go with the provider (ON DELETE CASCADE). */
  async removeFilesForProvider(providerId: string): Promise<void> {
    const files = this.repo.listByProvider(providerId).flatMap((v) => (v.filePath ? [v.filePath] : []));
    await Promise.all(files.map((f) => this.removeFile(f)));
  }

  /** Validates a provider's default voice: a clone must be one of its cloned voices, a design needs a description. */
  checkDefault(providerId: string, input: DefaultVoice): DefaultVoice {
    const provider = this.providers.getById(providerId);
    if (!CLONING_TYPES.has(provider.type)) throw new InputError(`${provider.label} does not support custom voices`);
    if (input.mode === "design") {
      const description = input.description?.trim();
      if (!description) throw new InputError("Enter a voice description to design a voice");
      return { mode: "design", description, voiceId: undefined };
    }
    const voice = input.voiceId ? this.repo.findById(input.voiceId) : null;
    if (!voice || voice.providerId !== providerId || voice.mode !== "clone") throw new InputError("Select one of this provider's cloned voices");
    return { mode: "clone", voiceId: voice.id, description: undefined };
  }

  /** Speaks `text` with a voice choice (saved or not) on the provider; the clip replaces this provider's last preview. */
  async preview(providerId: string, input: DefaultVoice & { text: string; language?: Language }): Promise<{ filePath: string }> {
    const provider = this.providers.getById(providerId);
    if (!provider.enabled) throw new InputError(`Enable ${provider.label} to try voices`);
    if (input.mode === "design" && !input.description?.trim()) throw new InputError("Enter a voice description to design a voice");
    if (input.mode === "clone" && !input.voiceId) throw new InputError("Select a cloned voice to try");
    const dir = this.storage.toAbsolute(`${VOICE_DIR}/previews`);
    await mkdir(dir, { recursive: true });
    const old = (await readdir(dir)).filter((f) => f.startsWith(`${providerId}-`));
    const path = await this.registry.get("audio", provider.slug).synthesize({
      text: input.text,
      language: input.language ?? "km",
      voice: input.mode === "clone" ? input.voiceId : undefined,
      voiceMode: input.mode,
      voiceDescription: input.mode === "design" ? input.description : undefined,
      outPath: join(dir, `${providerId}-${Date.now()}.mp3`),
    });
    await Promise.all(old.map((f) => rm(join(dir, f), { force: true })));
    return { filePath: this.storage.toRelative(path) };
  }

  resolve(id: string | undefined): ResolvedVoice | null {
    const voice = id ? this.repo.findById(id) : null;
    if (!voice) return null;
    const filePath = voice.mode === "clone" && voice.filePath ? this.storage.toAbsolute(voice.filePath) : null;
    // The transcript only describes a clip, so a designed voice never sends one.
    return { name: voice.name, mode: voice.mode, filePath, transcript: filePath ? voice.transcript : "", style: voice.style };
  }

  private static check(mode: VoiceMode, { hasFile, style }: { hasFile: boolean; style?: string }) {
    if (mode === "clone" && !hasFile) throw new InputError("A reference audio file is required to clone a voice");
    if (mode === "design" && !style?.trim()) throw new InputError("Describe the voice to design it");
  }

  /** Voice choices for a story: the given audio provider (or the default one) decides what a voice is. */
  options(
    audioSlug: string | undefined,
    language: Language,
  ): { providerId: string | null; cloning: boolean; voices: VoiceOption[]; defaultVoice: (DefaultVoice & { voiceName?: string }) | null } {
    const slug = audioSlug || this.registry.defaults.audio;
    const record = slug ? this.providers.findBySlug("audio", slug) : null;
    if (!record) return { providerId: null, cloning: false, voices: [], defaultVoice: null };
    const named = (names: string[]) => names.map((v) => ({ value: v, label: v }));
    const voices =
      record.type === "edge-tts"
        ? named(EdgeTtsProvider.VOICES[language])
        : record.type === "gemini-tts"
          ? named(GeminiTtsProvider.VOICES)
          : CLONING_TYPES.has(record.type)
            ? this.repo.listByProvider(record.id).map((v) => ({ value: v.id, label: v.name, mode: v.mode }))
            : [];
    // The provider's own default (from its voices dialog), shown as the story's fallback.
    const saved = record.config.defaultVoice as DefaultVoice | undefined;
    const defaultVoice = saved?.mode ? { ...saved, voiceName: saved.voiceId ? this.repo.findById(saved.voiceId)?.name : undefined } : null;
    return { providerId: record.id, cloning: CLONING_TYPES.has(record.type), voices, defaultVoice };
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
