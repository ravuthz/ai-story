import { writeBytes } from "../../utils/media";
import { BaseProvider } from "../BaseProvider";
import type { GeminiApi } from "../GeminiApi";
import type { ImageProvider, ImageRequest } from "../types";

export class GeminiImageProvider extends BaseProvider<"image"> implements ImageProvider {
  readonly id = "gemini";
  readonly kind = "image" as const;
  readonly label = "Gemini (Nano Banana)";

  constructor(private readonly api: GeminiApi, private readonly model: string) {
    super();
  }

  async isAvailable() {
    return this.api.configured;
  }

  async generate({ prompt, aspectRatio, outPath }: ImageRequest): Promise<string> {
    const { data } = await this.api.generateInlineData(this.model, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    });
    return writeBytes(outPath, data);
  }
}
