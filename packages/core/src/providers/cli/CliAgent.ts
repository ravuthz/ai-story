import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentId, AgentSettings } from "../../config";
import { CliRunner } from "./CliRunner";

export interface AgentRunOptions {
  /** Working directory; agents that write files are sandboxed to it. */
  cwd?: string;
  /** Allow the agent to write files / use tools without approval prompts. */
  allowWrite?: boolean;
  jsonSchema?: object;
}

/**
 * Base class for headless coding-agent CLIs (codex, claude, gemini, agy, omp).
 * Subclasses only describe how to build the argv; binary resolution,
 * running, timeouts and output capture are shared.
 */
export abstract class CliAgent {
  abstract readonly id: AgentId;
  abstract readonly label: string;

  /** CLI flag used to pick a model, e.g. "--model". */
  protected readonly modelFlag: string = "--model";

  constructor(
    protected readonly timeoutMs: number,
    protected readonly settings: AgentSettings,
  ) {}

  /** Executable from <ID>_BIN (absolute path or name on PATH). */
  get command(): string {
    return this.settings.bin;
  }

  /** Resolved executable path and model, for display. */
  get detail(): string {
    const resolved = CliRunner.resolve(this.command) ?? `${this.command} (not found)`;
    return this.model ? `${resolved} · model ${this.model}` : resolved;
  }

  protected get model(): string {
    return this.settings.model;
  }

  protected abstract buildArgs(prompt: string, options: AgentRunOptions, ctx: { outFile: string }): string[];

  protected modelArgs(): string[] {
    return this.model ? [this.modelFlag, this.model] : [];
  }

  /** Override to send the prompt on stdin instead of argv (buildArgs then gets an empty prompt). */
  protected readonly promptViaStdin: boolean = false;

  /** Override when the CLI writes its final answer to a file instead of stdout. */
  protected readonly writesToOutFile: boolean = false;

  isAvailable(): Promise<boolean> {
    return CliRunner.which(this.command);
  }

  async run(prompt: string, options: AgentRunOptions = {}): Promise<string> {
    const tmp = await mkdtemp(join(tmpdir(), `ai-story-${this.id}-`));
    const outFile = join(tmp, "last-message.txt");
    try {
      const args = this.buildArgs(this.promptViaStdin ? "" : prompt, options, { outFile });
      const { stdout } = await CliRunner.run(this.command, args, {
        stdin: this.promptViaStdin ? prompt : undefined,
        cwd: options.cwd ?? tmp,
        timeoutMs: this.timeoutMs,
        extraPath: this.settings.extraPath,
      });
      return this.writesToOutFile ? await readFile(outFile, "utf8") : stdout;
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
}
