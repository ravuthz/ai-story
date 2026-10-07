import { pcmToWav, writeBytes } from "../../utils/media";
import { BaseProvider } from "../BaseProvider";
import type { GeminiApi } from "../GeminiApi";
import type { AudioProvider, AudioRequest } from "../types";

const LANGUAGE_NAMES = { km: "Khmer", en: "English" } as const;

export class GeminiTtsProvider extends BaseProvider<"audio"> implements AudioProvider {
  readonly id = "gemini";
  readonly kind = "audio" as const;
  readonly label = "Gemini TTS";

  constructor(private readonly api: GeminiApi, private readonly model: string) {
    super();
  }

  async isAvailable() {
    return this.api.configured;
  }

  /** Gemini returns 24kHz 16-bit mono PCM; it is wrapped as WAV (outPath extension is forced to .wav). */
  async synthesize({ text, language, voice, outPath }: AudioRequest): Promise<string> {
    const { data } = await this.api.generateInlineData(this.model, {
      contents: [{ parts: [{ text: `Narrate warmly in ${LANGUAGE_NAMES[language]}, storyteller style:\n${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice ?? "Kore" } } },
      },
    });
    return writeBytes(outPath.replace(/\.\w+$/, ".wav"), pcmToWav(data));
  }
}
