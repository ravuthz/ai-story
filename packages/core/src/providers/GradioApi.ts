import { Client, handle_file } from "@gradio/client";
import { download, writeBytes } from "../utils/media";

type GradioFile = { url?: string; path?: string } | string;

/** Shared Gradio access: lazy connection reuse and file-result downloading. */
export class GradioApi {
  private client?: Promise<Client>;

  constructor(private readonly url: string, private readonly token?: string) {}

  get configured(): boolean {
    return !!this.url;
  }

  async predict(endpoint: string, params: Record<string, unknown>): Promise<unknown[]> {
    this.client ??= Client.connect(this.url, this.token ? { token: this.token as `hf_${string}` } : {});
    const result = await (await this.client).predict(endpoint, params);
    return result.data as unknown[];
  }

  static file(path: string) {
    return handle_file(new Blob([Bun.file(path)]));
  }

  /** Saves the first file-like value in a Gradio result to `outPath`. */
  async saveFirstFile(data: unknown[], outPath: string): Promise<string> {
    const file = GradioApi.findFile(data);
    if (!file) throw new Error(`Gradio ${this.url} returned no file: ${JSON.stringify(data).slice(0, 300)}`);
    if (typeof file === "string" && file.startsWith("data:")) {
      return writeBytes(outPath, Buffer.from(file.split(",")[1] ?? "", "base64"));
    }
    const url = typeof file === "string" ? file : file.url ?? file.path!;
    return download(url, outPath, this.token ? { authorization: `Bearer ${this.token}` } : {});
  }

  private static findFile(value: unknown): GradioFile | undefined {
    if (typeof value === "string" && /^(https?:|data:)/.test(value)) return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = GradioApi.findFile(item);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.url === "string") return obj as GradioFile;
      for (const v of Object.values(obj)) {
        const found = GradioApi.findFile(v);
        if (found) return found;
      }
    }
    return undefined;
  }
}
