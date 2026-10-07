import type { Job } from "../../domain/types";
import { BaseRepository, pickColumns } from "./BaseRepository";

export class JobRepository extends BaseRepository<Job> {
  protected readonly table = "jobs";

  /** Atomically claims the oldest queued job. */
  claimNext(): Job | null {
    return this.db.transaction(() => {
      const [job] = this.list({ where: { status: "queued" }, orderBy: "created_at", limit: 1 });
      if (!job) return null;
      return this.update(job.id, { status: "running", updatedAt: new Date().toISOString() });
    });
  }

  /** Jobs left "running" by a crashed process are re-queued on startup. */
  requeueStale(): number {
    return this.db.sql.query("UPDATE jobs SET status = 'queued' WHERE status = 'running'").run().changes;
  }

  protected toEntity(row: Record<string, unknown>): Job {
    return {
      id: row.id as string,
      type: row.type as Job["type"],
      status: row.status as Job["status"],
      payload: JSON.parse(row.payload as string),
      progress: row.progress as number,
      message: row.message as string,
      error: (row.error as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  protected toRow(j: Partial<Job>) {
    return pickColumns<Job>(j, {
      id: ["id"],
      type: ["type"],
      status: ["status"],
      payload: ["payload", (p) => JSON.stringify(p)],
      progress: ["progress"],
      message: ["message"],
      error: ["error"],
      createdAt: ["created_at"],
      updatedAt: ["updated_at"],
    });
  }
}
