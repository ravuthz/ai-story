import type { AgentId, AgentSettings } from "../../config";
import { CliAgent, type AgentRunOptions } from "./CliAgent";

export class CodexAgent extends CliAgent {
  readonly id = "codex";
  readonly label = "OpenAI Codex CLI";
  protected override readonly writesToOutFile = true;

  protected buildArgs(prompt: string, o: AgentRunOptions, { outFile }: { outFile: string }): string[] {
    return [
      "exec",
      ...this.modelArgs(),
      "--skip-git-repo-check",
      "--ephemeral",
      "--sandbox", o.allowWrite ? "workspace-write" : "read-only",
      ...(o.allowWrite ? ["--enable", "image_generation"] : []),
      "--output-last-message", outFile,
      prompt,
    ];
  }
}

export class ClaudeAgent extends CliAgent {
  readonly id = "claude";
  readonly label = "Claude Code CLI";
  // `--tools <tools...>` is variadic and would swallow a trailing prompt argument.
  protected override readonly promptViaStdin = true;

  protected buildArgs(_prompt: string, o: AgentRunOptions): string[] {
    return [
      "--print",
      ...this.modelArgs(),
      "--output-format", "text",
      "--no-session-persistence",
      ...(o.allowWrite ? ["--dangerously-skip-permissions"] : ["--tools", ""]),
    ];
  }
}

export class GeminiAgent extends CliAgent {
  readonly id = "gemini";
  readonly label = "Google Gemini CLI";

  protected buildArgs(prompt: string, o: AgentRunOptions): string[] {
    return [...this.modelArgs(), "--skip-trust", "--output-format", "text", "--approval-mode", o.allowWrite ? "yolo" : "plan", "-p", prompt];
  }
}

export class AgyAgent extends CliAgent {
  readonly id = "agy";
  readonly label = "Antigravity CLI";

  protected buildArgs(prompt: string, o: AgentRunOptions): string[] {
    return [
      ...this.modelArgs(),
      "--output-format", "text",
      ...(o.allowWrite ? ["--dangerously-skip-permissions"] : ["--mode", "plan"]),
      ...(o.jsonSchema ? ["--json-schema", JSON.stringify(o.jsonSchema)] : []),
      // agy consumes the value right after --print as the prompt.
      "--print", prompt,
    ];
  }
}

export class OmpAgent extends CliAgent {
  readonly id = "omp";
  readonly label = "Oh My Pi (omp)";

  protected buildArgs(prompt: string, o: AgentRunOptions): string[] {
    return ["--print", "--no-session", ...this.modelArgs(), ...(o.allowWrite ? [] : ["--no-tools"]), prompt];
  }
}

const AGENT_CLASSES: Record<AgentId, new (timeoutMs: number, settings: AgentSettings) => CliAgent> = {
  codex: CodexAgent,
  claude: ClaudeAgent,
  gemini: GeminiAgent,
  agy: AgyAgent,
  omp: OmpAgent,
};

export const createAgents = (timeoutMs: number, settings: Record<AgentId, AgentSettings>): CliAgent[] =>
  (Object.keys(AGENT_CLASSES) as AgentId[]).map((id) => new AGENT_CLASSES[id](timeoutMs, settings[id]));
