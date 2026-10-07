import { BaseProvider } from "../BaseProvider";
import type { GradioApi } from "../GradioApi";
import type { ImageProvider, ImageRequest } from "../types";

/** Remote Qwen-Image via a Gradio app (HF Space id or self-hosted URL). */
export class QwenGradioImageProvider extends BaseProvider<"image"> implements ImageProvider {
  readonly id = "qwen";
  readonly kind = "image" as const;
  readonly label = "Qwen-Image (Gradio)";

  constructor(private readonly gradio: GradioApi, private readonly endpoint: string) {
    super();
  }

  async isAvailable() {
    return this.gradio.configured;
  }

  async generate({ prompt, aspectRatio, outPath }: ImageRequest): Promise<string> {
    const data = await this.gradio.predict(this.endpoint, {
      prompt,
      aspect_ratio: aspectRatio,
      randomize_seed: true,
    });
    return this.gradio.saveFirstFile(data, outPath);
  }
}
