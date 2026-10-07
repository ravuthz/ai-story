import type { Voice, VoiceMode } from "../../domain/types";
import { BaseRepository, pickColumns } from "./BaseRepository";

export class VoiceRepository extends BaseRepository<Voice> {
  protected readonly table = "voices";

  listByProvider(providerId: string): Voice[] {
    return this.list({ where: { provider_id: providerId }, orderBy: "name COLLATE NOCASE" });
  }

  protected toEntity(row: Record<string, unknown>): Voice {
    return {
      id: row.id as string,
      providerId: row.provider_id as string,
      name: row.name as string,
      mode: row.mode as VoiceMode,
      // Designed voices have no clip; the NOT NULL column stores "".
      filePath: (row.file_path as string) || null,
      transcript: row.transcript as string,
      style: row.style as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  protected toRow(v: Partial<Voice>) {
    return pickColumns<Voice>(v, {
      id: ["id"],
      providerId: ["provider_id"],
      name: ["name"],
      mode: ["mode"],
      filePath: ["file_path", (v) => v ?? ""],
      transcript: ["transcript"],
      style: ["style"],
      createdAt: ["created_at"],
      updatedAt: ["updated_at"],
    });
  }
}
