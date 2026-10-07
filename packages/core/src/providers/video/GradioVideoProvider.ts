import { GradioApi } from "../GradioApi";
import type { VideoClip } from "../types";
import { Ffmpeg } from "./Ffmpeg";
import { RemoteVideoProvider } from "./RemoteVideoProvider";

/** Remote image-to-video through a Gradio app (e.g. a Wan 2.x space). */
export class GradioVideoProvider extends RemoteVideoProvider {
  readonly id = "gradio";
  readonly label = "Image-to-video (Gradio)";

  constructor(private readonly gradio: GradioApi, private readonly endpoint: string) {
    super();
  }

  async isAvailable() {
    return this.gradio.configured && (await Ffmpeg.isAvailable());
  }

  protected async fetchRaw(clip: VideoClip, durationSec: number, rawPath: string): Promise<string> {
    const data = await this.gradio.predict(this.endpoint, {
      input_image: GradioApi.file(clip.imagePath),
      prompt: clip.prompt ?? "subtle cinematic camera motion",
      duration_seconds: Math.min(durationSec, 8),
    });
    return this.gradio.saveFirstFile(data, rawPath);
  }
}
