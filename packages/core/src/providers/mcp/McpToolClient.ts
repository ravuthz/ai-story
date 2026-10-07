import { copyFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { download, writeBytes } from "../../utils/media";

export interface McpServerConfig {
  /** stdio server */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** or a remote Streamable HTTP server */
  url?: string;
}

type ToolContent = {
  type: string;
  data?: string;
  text?: string;
  resource?: { uri?: string; blob?: string; text?: string };
};

/** Connects to one MCP server lazily and turns tool results into files on disk. */
export class McpToolClient {
  private client?: Promise<Client>;

  constructor(private readonly server: McpServerConfig) {}

  async callToFile(tool: string, args: Record<string, unknown>, outPath: string): Promise<string> {
    const client = await this.connect();
    const result = (await client.callTool({ name: tool, arguments: args })) as { content?: ToolContent[]; isError?: boolean };
    const content = result.content ?? [];
    if (result.isError) throw new Error(`MCP tool ${tool} failed: ${content.map((c) => c.text).join(" ")}`);
    return McpToolClient.saveContent(content, outPath);
  }

  async close() {
    if (this.client) await (await this.client).close();
    this.client = undefined;
  }

  private connect(): Promise<Client> {
    this.client ??= (async () => {
      const client = new Client({ name: "ai-story", version: "0.1.0" });
      const transport = this.server.url
        ? new StreamableHTTPClientTransport(new URL(this.server.url))
        : new StdioClientTransport({
            command: this.server.command!,
            args: this.server.args ?? [],
            env: { ...(process.env as Record<string, string>), ...this.server.env },
          });
      await client.connect(transport);
      return client;
    })();
    return this.client;
  }

  /** Accepts inline base64 media, embedded blobs, or a URL / absolute file path in text. */
  private static async saveContent(content: ToolContent[], outPath: string): Promise<string> {
    for (const item of content) {
      const base64 = item.data ?? item.resource?.blob;
      if (base64) return writeBytes(outPath, Buffer.from(base64, "base64"));
      const ref = item.resource?.uri ?? item.text?.match(/(https?:\/\/\S+|file:\/\/\S+|\/\S+\.\w{2,4})/)?.[0];
      if (!ref) continue;
      if (/^https?:/.test(ref)) return download(ref, outPath);
      await copyFile(ref.replace(/^file:\/\//, ""), outPath);
      return outPath;
    }
    throw new Error("MCP tool returned no media");
  }
}
