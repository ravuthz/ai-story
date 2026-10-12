import type { FingerprintStore } from "../../domain/BlueprintGenerator";
import { StorySettingsSchema, type Story } from "../../domain/types";
import { BaseRepository, pickColumns } from "./BaseRepository";

export class StoryRepository extends BaseRepository<Story> implements FingerprintStore {
  protected readonly table = "stories";

  hasFingerprint(fingerprint: string): boolean {
    return !!this.db.sql.query("SELECT 1 FROM stories WHERE fingerprint = $fingerprint").get({ fingerprint });
  }

  countByCategory(): Record<string, number> {
    const rows = this.db.sql
      .query<{ category: string; n: number }, []>("SELECT category, COUNT(*) AS n FROM stories GROUP BY category")
      .all();
    return Object.fromEntries(rows.map((r) => [r.category, r.n]));
  }

  protected toEntity(row: Record<string, unknown>): Story {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      category: row.category as Story["category"],
      title: row.title as string,
      slug: row.slug as string,
      synopsis: row.synopsis as string,
      moral: row.moral as string,
      status: row.status as Story["status"],
      blueprint: JSON.parse(row.blueprint as string),
      settings: StorySettingsSchema.parse(JSON.parse(row.settings as string)),
      script: (row.script as string | null) ?? null,
      videoPath: (row.video_path as string | null) ?? null,
      error: (row.error as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  protected toRow(s: Partial<Story>) {
    const row = pickColumns<Story>(s, {
      id: ["id"],
      projectId: ["project_id"],
      category: ["category"],
      title: ["title"],
      slug: ["slug"],
      synopsis: ["synopsis"],
      moral: ["moral"],
      status: ["status"],
      blueprint: ["blueprint", (b) => JSON.stringify(b)],
      settings: ["settings", (v) => JSON.stringify(v)],
      script: ["script"],
      videoPath: ["video_path"],
      error: ["error"],
      createdAt: ["created_at"],
      updatedAt: ["updated_at"],
    });
    // The fingerprint gets its own column so SQLite enforces blueprint uniqueness.
    if (s.blueprint) row.fingerprint = s.blueprint.fingerprint;
    return row;
  }
}
