import { rm } from "node:fs/promises";
import type { VideoClip, VideoClipRequest, VideoProvider } from "../types";
import { Ffmpeg } from "./Ffmpeg";

/**
 * Template for providers that fetch a short generated video remotely. The raw
 * result is looped/fitted to the frame and muxed with narration locally, so
 * every clip still matches the shared encode profile.
 */
export abstract class RemoteVideoProvider implements VideoProvider {
  abstract readonly id: string;
  abstract readonly label: string;
  readonly kind = "video" as const;

  abstract isAvailable(): Promise<boolean>;

  /** Generate a raw video for the clip and save it at `rawPath`. */
  protected abstract fetchRaw(clip: VideoClip, durationSec: number, rawPath: string): Promise<string>;

  async renderClip({ clip, aspectRatio, outPath }: VideoClipRequest): Promise<string> {
    const durationSec = await Ffmpeg.clipDuration(clip.durationSec, clip.audioPath);
    const raw = await this.fetchRaw(clip, durationSec, outPath.replace(/\.mp4$/, ".raw.mp4"));
    try {
      return await Ffmpeg.encodeClip({
        videoInput: ["-stream_loop", "-1", "-i", raw],
        videoFilter: Ffmpeg.fillFrame(aspectRatio),
        audioPath: clip.audioPath,
        durationSec,
        aspectRatio,
        outPath,
      });
    } finally {
      await rm(raw, { force: true });
    }
  }
}
