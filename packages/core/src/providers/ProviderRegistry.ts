import type { ProviderKind } from "../domain/types";
import type { AnyProvider, ProviderByKind, ProviderInfo } from "./types";

export class ProviderRegistry {
  private readonly providers = new Map<string, AnyProvider>();

  constructor(private readonly defaults: Record<ProviderKind, string>) {}

  register(...providers: AnyProvider[]): this {
    for (const p of providers) this.providers.set(ProviderRegistry.key(p.kind, p.id), p);
    return this;
  }

  /** Resolves a provider by id, falling back to the configured default for that kind. */
  get<K extends ProviderKind>(kind: K, id?: string): ProviderByKind[K] {
    const resolved = id || this.defaults[kind];
    const provider = this.providers.get(ProviderRegistry.key(kind, resolved));
    if (!provider) throw new Error(`No ${kind} provider "${resolved}". Available: ${this.ids(kind).join(", ")}`);
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
