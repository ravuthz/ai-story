import type { Project } from "../../domain/types";
import { BaseRepository, pickColumns } from "./BaseRepository";

export class ProjectRepository extends BaseRepository<Project> {
  protected readonly table = "projects";

  findBySlug(slug: string): Project | null {
    return this.list({ where: { slug } })[0] ?? null;
  }

  protected toEntity(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: row.description as string,
      createdAt: row.created_at as string,
    };
  }

  protected toRow(p: Partial<Project>) {
    return pickColumns<Project>(p, {
      id: ["id"],
      name: ["name"],
      slug: ["slug"],
      description: ["description"],
      createdAt: ["created_at"],
    });
  }
}
