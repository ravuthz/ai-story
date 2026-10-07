import type { ProviderKind } from "../domain/types";
import type { AnyProvider, ProviderByKind, ProviderInfo } from "./types";

/** Live set of providers, kept in sync with the `providers` table by ProviderService. */
export class ProviderRegistry {
  private readonly providers = new Map<string, AnyProvider>();
  private readonly defaultIds: Partial<Record<ProviderKind, string>> = {};

  /** Adds or replaces a provider; the replaced instance is disposed. */
  set(provider: AnyProvider): this {
    const key = ProviderRegistry.key(provider.kind, provider.id);
    const previous = this.providers.get(key);
    this.providers.set(key, provider);
    if (previous && previous !== provider) void previous.dispose?.().catch(() => {});
    return this;
  }

  remove(kind: ProviderKind, id: string): void {
    const key = ProviderRegistry.key(kind, id);
    void this.providers.get(key)?.dispose?.().catch(() => {});
    this.providers.delete(key);
  }

  setDefault(kind: ProviderKind, id: string | undefined): void {
    this.defaultIds[kind] = id;
  }

  get defaults(): Partial<Record<ProviderKind, string>> {
    return { ...this.defaultIds };
  }

  /** Resolves a provider by id, falling back to the configured default for that kind. */
  get<K extends ProviderKind>(kind: K, id?: string): ProviderByKind[K] {
    const resolved = id || this.defaultIds[kind];
    if (!resolved) throw new Error(`No default ${kind} provider configured. Available: ${this.ids(kind).join(", ") || "none"}`);
    const provider = this.providers.get(ProviderRegistry.key(kind, resolved));
    if (!provider) throw new Error(`No enabled ${kind} provider "${resolved}". Available: ${this.ids(kind).join(", ") || "none"}`);
    return provider as ProviderByKind[K];
  }

  ids(kind: ProviderKind): string[] {
    return [...this.providers.values()].filter((p) => p.kind === kind).map((p) => p.id);
  }

  async describe(): Promise<ProviderInfo[]> {
    return Promise.all(
      [...this.providers.values()].map(async (p) => ({
        id: p.id,
        kind: p.kind,
        label: p.label,
        detail: p.detail,
        available: await p.isAvailable().catch(() => false),
      })),
    );
  }

  private static key(kind: ProviderKind, id: string): string {
    return `${kind}:${id}`;
  }
}
