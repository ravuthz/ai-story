import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
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
  /** Silence kept after narration so it is never cut off by the fade. */
  static readonly NARRATION_TAIL_SEC = 0.6;
  private static readonly TIMEOUT_MS = 30 * 60_000;
  /** Output params shared by every clip so the final concat can stream-copy. */
  private static readonly CLIP_CODEC_ARGS = [
    "-r", String(Ffmpeg.FPS),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
  ];

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
    const narration = audioPath ? (await Ffmpeg.probeDuration(audioPath)) + Ffmpeg.NARRATION_TAIL_SEC : 0;
    return Math.max(durationSec, narration);
  }

  /**
   * Writes a sped-up copy of `path` (pitch preserved) lasting at most `targetSec` to `outPath`.
   * Returns `path` unchanged when it is already short enough; tempo is capped at 2× so speech stays intelligible.
   */
  static async speedUpToFit(path: string, targetSec: number, outPath: string): Promise<string> {
    const current = await Ffmpeg.probeDuration(path);
    const tempo = Math.min(2, current / targetSec);
    if (!current || tempo < 1.01) return path;
    await Ffmpeg.run(["-i", path, "-filter:a", `atempo=${tempo.toFixed(4)}`, outPath]);
    return outPath;
  }

  /** Cuts an encoded clip in place to `durationSec`, re-applying the fade-out at the new end. */
  static async trimClip(path: string, durationSec: number): Promise<string> {
    const fadeOut = Math.max(0, durationSec - Ffmpeg.FADE_SEC);
    const tmp = join(dirname(path), `.trim-${Date.now()}${extname(path)}`);
    await Ffmpeg.run([
      "-i", path,
      "-filter_complex", `[0:v]fade=t=out:st=${fadeOut}:d=${Ffmpeg.FADE_SEC},format=yuv420p[v];[0:a]afade=t=out:st=${fadeOut}:d=${Ffmpeg.FADE_SEC}[a]`,
      "-map", "[v]", "-map", "[a]",
      "-t", durationSec.toFixed(2),
      ...Ffmpeg.CLIP_CODEC_ARGS,
      tmp,
    ]);
    await rename(tmp, path);
    return path;
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
      ...Ffmpeg.CLIP_CODEC_ARGS,
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
