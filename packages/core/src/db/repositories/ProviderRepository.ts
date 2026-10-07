import type { ProviderKind, ProviderRecord } from "../../domain/types";
import { BaseRepository, pickColumns } from "./BaseRepository";

export class ProviderRepository extends BaseRepository<ProviderRecord> {
  protected readonly table = "providers";

  findBySlug(kind: ProviderKind, slug: string): ProviderRecord | null {
    return this.list({ where: { kind, slug } })[0] ?? null;
  }

  /** Makes `id` the only default of its kind. */
  setDefault(id: string): ProviderRecord {
    const { kind } = this.getById(id);
    this.db.transaction(() => {
      this.db.sql.query("UPDATE providers SET is_default = 0 WHERE kind = $kind").run({ kind });
      this.db.sql.query("UPDATE providers SET is_default = 1 WHERE id = $id").run({ id });
    });
    return this.getById(id);
  }

  protected toEntity(row: Record<string, unknown>): ProviderRecord {
    return {
      id: row.id as string,
      kind: row.kind as ProviderKind,
      slug: row.slug as string,
      type: row.type as string,
      label: row.label as string,
      enabled: !!row.enabled,
      isDefault: !!row.is_default,
      config: JSON.parse(row.config as string) as Record<string, unknown>,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  protected toRow(p: Partial<ProviderRecord>) {
    return pickColumns<ProviderRecord>(p, {
      id: ["id"],
      kind: ["kind"],
      slug: ["slug"],
      type: ["type"],
      label: ["label"],
      enabled: ["enabled", (v) => (v ? 1 : 0)],
      isDefault: ["is_default", (v) => (v ? 1 : 0)],
      config: ["config", (v) => JSON.stringify(v ?? {})],
      createdAt: ["created_at"],
      updatedAt: ["updated_at"],
    });
  }
}
