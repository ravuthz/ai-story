import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { AspectRatio } from "../../domain/types";
import { DIMENSIONS } from "../../utils/media";
import { CliRunner } from "../cli/CliRunner";

export interface ClipEncodeOptions {
  /** ffmpeg input args producing the visual stream at index 0. */
  videoInput: string[];
  /** Filter chain applied to [0:v] before the shared fade/format steps. */
  videoFilter: string;
  audioPath?: string | null;
  durationSec: number;
  aspectRatio: AspectRatio;
  outPath: string;
}

/**
 * All ffmpeg knowledge in one place. Every clip is encoded with identical
 * codec/fps/resolution/audio params so the final concat can stream-copy.
 */
export class Ffmpeg {
  static readonly FPS = 30;
  static readonly FADE_SEC = 0.4;
  private static readonly TIMEOUT_MS = 30 * 60_000;

  static isAvailable(): Promise<boolean> {
    return CliRunner.which("ffmpeg");
  }

  static async probeDuration(path: string): Promise<number> {
    const { stdout } = await CliRunner.run(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
      { timeoutMs: 60_000 },
    );
    return Number(stdout.trim()) || 0;
  }

  /** Clip length = configured scene duration, extended so narration is never cut off. */
  static async clipDuration(durationSec: number, audioPath?: string | null): Promise<number> {
    const narration = audioPath ? (await Ffmpeg.probeDuration(audioPath)) + 0.6 : 0;
    return Math.max(durationSec, narration);
  }

  static async encodeClip(o: ClipEncodeOptions): Promise<string> {
    const fadeOut = Math.max(0, o.durationSec - Ffmpeg.FADE_SEC);
    const audioInput = o.audioPath ? ["-i", o.audioPath] : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
    const filter = [
      `[0:v]${o.videoFilter},fade=t=in:st=0:d=${Ffmpeg.FADE_SEC},fade=t=out:st=${fadeOut}:d=${Ffmpeg.FADE_SEC},format=yuv420p,setsar=1[v]`,
      `[1:a]apad,aresample=44100,aformat=channel_layouts=stereo[a]`,
    ].join(";");
    await mkdir(dirname(o.outPath), { recursive: true });
    await Ffmpeg.run([
      ...o.videoInput,
      ...audioInput,
      "-filter_complex", filter,
      "-map", "[v]", "-map", "[a]",
      "-t", o.durationSec.toFixed(2),
      "-r", String(Ffmpeg.FPS),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart",
      o.outPath,
    ]);
    return o.outPath;
  }

  /** Scale + crop any source to fill the target frame. */
  static fillFrame(aspectRatio: AspectRatio, scale = 1): string {
    const { width, height } = DIMENSIONS[aspectRatio];
    const w = width * scale;
    const h = height * scale;
    return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  }

  static async concat(clips: string[], outPath: string): Promise<string> {
    const list = join(dirname(outPath), `.concat-${Date.now()}.txt`);
    await writeFile(list, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n"));
    await Ffmpeg.run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", outPath]);
    await Bun.file(list).delete();
    return outPath;
  }

  static run(args: string[]) {
    return CliRunner.run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { timeoutMs: Ffmpeg.TIMEOUT_MS });
  }
}
