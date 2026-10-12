import type { MotionType } from "../../domain/types";
import { DIMENSIONS } from "../../utils/media";
import type { VideoClipRequest, VideoProvider } from "../types";
import { Ffmpeg } from "./Ffmpeg";

const ZOOM = 0.15;

/** zoompan expressions per motion; `N` is replaced with the clip's frame count. */
const MOTIONS: Record<MotionType, { z: string; x: string; y: string }> = {
  "zoom-in": { z: `1+${ZOOM}*on/N`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  "zoom-out": { z: `1+${ZOOM}-${ZOOM}*on/N`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  "pan-left": { z: `1+${ZOOM}`, x: "(iw-iw/zoom)*(1-on/N)", y: "ih/2-(ih/zoom/2)" },
  "pan-right": { z: `1+${ZOOM}`, x: "(iw-iw/zoom)*on/N", y: "ih/2-(ih/zoom/2)" },
  "pan-up": { z: `1+${ZOOM}`, x: "iw/2-(iw/zoom/2)", y: "(ih-ih/zoom)*(1-on/N)" },
  "pan-down": { z: `1+${ZOOM}`, x: "iw/2-(iw/zoom/2)", y: "(ih-ih/zoom)*on/N" },
  "pan-up-left": { z: `1+${ZOOM}`, x: "(iw-iw/zoom)*(1-on/N)", y: "(ih-ih/zoom)*(1-on/N)" },
  "pan-up-right": { z: `1+${ZOOM}`, x: "(iw-iw/zoom)*on/N", y: "(ih-ih/zoom)*(1-on/N)" },
  "pan-down-left": { z: `1+${ZOOM}`, x: "(iw-iw/zoom)*(1-on/N)", y: "(ih-ih/zoom)*on/N" },
  "pan-down-right": { z: `1+${ZOOM}`, x: "(iw-iw/zoom)*on/N", y: "(ih-ih/zoom)*on/N" },
  // Zoom in while the frame drifts from the centre to one side.
  "zoom-in-left": { z: `1+${ZOOM}*on/N`, x: "(iw-iw/zoom)*(1-on/N)/2", y: "ih/2-(ih/zoom/2)" },
  "zoom-in-right": { z: `1+${ZOOM}*on/N`, x: "(iw-iw/zoom)*(1+on/N)/2", y: "ih/2-(ih/zoom/2)" },
};

/** Local Ken Burns style motion video from a still image (no GPU / API needed). */
export class FfmpegMotionVideoProvider implements VideoProvider {
  readonly id = "ffmpeg";
  readonly kind = "video" as const;
  readonly label = "FFmpeg motion (Ken Burns)";

  isAvailable() {
    return Ffmpeg.isAvailable();
  }

  async renderClip({ clip, aspectRatio, outPath }: VideoClipRequest): Promise<string> {
    const durationSec = await Ffmpeg.clipDuration(clip.durationSec, clip.audioPath);
    const frames = Math.ceil(durationSec * Ffmpeg.FPS);
    const { width, height } = DIMENSIONS[aspectRatio];
    const m = MOTIONS[clip.motion];
    const expr = (e: string) => `'${e.replaceAll("N", String(frames))}'`;
    return Ffmpeg.encodeClip({
      // A single still frame in: zoompan itself emits `frames` output frames.
      videoInput: ["-i", clip.imagePath],
      // Upscale 2× before zoompan to avoid jitter on sub-pixel motion.
      videoFilter: `${Ffmpeg.fillFrame(aspectRatio, 2)},zoompan=z=${expr(m.z)}:x=${expr(m.x)}:y=${expr(m.y)}:d=${frames}:s=${width}x${height}:fps=${Ffmpeg.FPS}`,
      audioPath: clip.audioPath,
      durationSec,
      aspectRatio,
      outPath,
    });
  }
}
