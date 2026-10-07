import type { ProjectRepository } from "../db/repositories/ProjectRepository";
import type { StoryRepository } from "../db/repositories/StoryRepository";
import type { Project } from "../domain/types";
import type { ProjectStorage } from "../storage/ProjectStorage";
import { newId, nowIso, slugify } from "../utils/text";

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly stories: StoryRepository,
    private readonly storage: ProjectStorage,
  ) {}

  list() {
    return this.projects.list({ orderBy: "created_at DESC" }).map((p) => ({
      ...p,
      storyCount: this.stories.count({ project_id: p.id }),
    }));
  }

  get(id: string): Project {
    return this.projects.getById(id);
  }

  create(input: { name: string; description?: string }): Project {
    let slug = slugify(input.name);
    if (this.projects.findBySlug(slug)) slug = `${slug}-${newId().slice(0, 4)}`;
    return this.projects.insert({ id: newId(), name: input.name, slug, description: input.description ?? "", createdAt: nowIso() });
  }

  /** Returns the project with this name, creating it if missing (handy for CLI/MCP callers). */
  findOrCreate(name: string): Project {
    return this.projects.findBySlug(slugify(name)) ?? this.create({ name });
  }

  async delete(id: string): Promise<void> {
    const project = this.projects.getById(id);
    this.projects.delete(id);
    await this.storage.removeProject(project.slug);
  }
}
