import { mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type { CliAgent } from "../cli/CliAgent";
import type { ImageProvider, ImageRequest } from "../types";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** Uses the local Codex CLI's built-in image_generation tool, sandboxed to the output folder. */
export class CodexImageProvider implements ImageProvider {
  readonly id = "codex";
  readonly kind = "image" as const;
  readonly label = "Codex CLI (local)";

  constructor(private readonly agent: CliAgent) {}

  get detail() {
    return this.agent.detail;
  }

  isAvailable() {
    return this.agent.isAvailable();
  }

  async generate({ prompt, aspectRatio, outPath }: ImageRequest): Promise<string> {
    // Each call gets its own scratch folder so concurrent scenes never pick up each other's files.
    await mkdir(dirname(outPath), { recursive: true });
    const cwd = await mkdtemp(join(dirname(outPath), ".codex-"));
    try {
      return await this.generateIn(cwd, prompt, aspectRatio, outPath);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }

  private async generateIn(cwd: string, prompt: string, aspectRatio: string, outPath: string): Promise<string> {
    const target = join(cwd, basename(outPath));
    await this.agent.run(
      [
        "Generate exactly one image with your image generation tool.",
        `Aspect ratio: ${aspectRatio}. No text, captions or watermarks in the image.`,
        `Save it in the current directory as "${basename(outPath)}" (PNG). Do not create any other files.`,
        `Image description: ${prompt}`,
        "When finished reply with only: DONE",
      ].join("\n"),
      { cwd, allowWrite: true },
    );
    // Prefer the requested name, otherwise take the newest image the agent wrote.
    const produced = (await Bun.file(target).exists()) ? target : await this.newestImage(cwd);
    if (!produced) throw new Error("Codex did not produce an image file");
    await rename(produced, outPath);
    return outPath;
  }

  private async newestImage(dir: string): Promise<string | null> {
    let best: { path: string; mtime: number } | null = null;
    for (const name of await readdir(dir)) {
      if (!IMAGE_EXT.has(extname(name).toLowerCase())) continue;
      const path = join(dir, name);
      const { mtimeMs } = await stat(path);
      if (!best || mtimeMs > best.mtime) best = { path, mtime: mtimeMs };
    }
    return best?.path ?? null;
  }
}
