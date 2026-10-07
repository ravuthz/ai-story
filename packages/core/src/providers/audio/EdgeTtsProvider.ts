import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Language } from "../../domain/types";
import { writeBytes } from "../../utils/media";
import { BaseProvider } from "../BaseProvider";
import type { AudioProvider, AudioRequest } from "../types";

/** Free Microsoft Edge neural voices — includes native Khmer (km-KH) voices. */
export class EdgeTtsProvider extends BaseProvider<"audio"> implements AudioProvider {
  static readonly VOICES: Record<Language, string[]> = {
    km: ["km-KH-SreymomNeural", "km-KH-PisethNeural"],
    en: ["en-US-AriaNeural", "en-US-GuyNeural", "en-GB-SoniaNeural"],
  };

  readonly id = "edge";
  readonly kind = "audio" as const;
  readonly label = "Edge TTS (Khmer + English)";

  async isAvailable() {
    return true;
  }

  async synthesize({ text, language, voice, outPath }: AudioRequest): Promise<string> {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice ?? EdgeTtsProvider.VOICES[language][0]!, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text);
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) chunks.push(chunk as Buffer);
      if (!chunks.length) throw new Error("Edge TTS returned no audio");
      return writeBytes(outPath, Buffer.concat(chunks));
    } finally {
      tts.close();
    }
  }
}
