import type { ProviderKind } from "../domain/types";
import type { Provider } from "./types";

/** Common identity + availability check for HTTP/API based providers. */
export abstract class BaseProvider<K extends ProviderKind> implements Provider {
  abstract readonly id: string;
  abstract readonly kind: K;
  abstract readonly label: string;

  /** Returns true when required configuration (keys, URLs, binaries) is present. */
  abstract isAvailable(): Promise<boolean>;

  protected assertConfigured(value: string, name: string): void {
    if (!value) throw new Error(`${this.label}: missing ${name}`);
  }
}
