import type { CliAgent } from "../cli/CliAgent";
import type { TextProvider, TextRequest } from "../types";

/** Adapts any headless agent CLI to the TextProvider interface. */
export class AgentTextProvider implements TextProvider {
  readonly kind = "text" as const;

  constructor(private readonly agent: CliAgent) {}

  get id() {
    return this.agent.id;
  }
  get label() {
    return this.agent.label;
  }

  get detail() {
    return this.agent.detail;
  }

  isAvailable() {
    return this.agent.isAvailable();
  }

  complete({ prompt, jsonSchema }: TextRequest): Promise<string> {
    return this.agent.run(prompt, { jsonSchema });
  }
}
