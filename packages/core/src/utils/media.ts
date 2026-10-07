import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AspectRatio } from "../domain/types";

export const DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

export async function writeBytes(path: string, data: ArrayBuffer | Uint8Array | Buffer): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data instanceof ArrayBuffer ? new Uint8Array(data) : data);
  return path;
}

export async function download(url: string, path: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  return writeBytes(path, await res.arrayBuffer());
}

/** Wraps raw 16-bit little-endian PCM in a WAV container. */
export function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
