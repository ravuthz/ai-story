import { config as defaultConfig, type AppConfig } from "./config";
import { Database } from "./db/Database";
import { JobRepository } from "./db/repositories/JobRepository";
import { ProjectRepository } from "./db/repositories/ProjectRepository";
import { SceneRepository } from "./db/repositories/SceneRepository";
import { StoryRepository } from "./db/repositories/StoryRepository";
import { categoryRegistry } from "./domain/categories/CategoryRegistry";
import { BatchSchema, GenerateStoryJobSchema, RenderJobSchema } from "./domain/schemas";
import { ProviderFactory } from "./providers/factory";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { JobQueue } from "./services/JobQueue";
import { ProjectService } from "./services/ProjectService";
import { RenderService } from "./services/RenderService";
import { StoryService } from "./services/StoryService";
import { ProjectStorage } from "./storage/ProjectStorage";

/** Composition root: wires repositories, providers, services and job handlers. */
export class App {
  readonly db: Database;
  readonly storage: ProjectStorage;
  readonly categories = categoryRegistry;
  readonly providers: ProviderRegistry;
  readonly projects: ProjectService;
  readonly stories: StoryService;
  readonly renderer: RenderService;
  readonly jobs: JobQueue;

  constructor(readonly config: AppConfig = defaultConfig) {
    this.db = new Database(config.databasePath);
    this.storage = new ProjectStorage(config.storageDir);
    this.providers = ProviderFactory.registry(config);

    const projectRepo = new ProjectRepository(this.db);
    const storyRepo = new StoryRepository(this.db);
    const sceneRepo = new SceneRepository(this.db);

    this.projects = new ProjectService(projectRepo, storyRepo, this.storage);
    this.stories = new StoryService(storyRepo, sceneRepo, projectRepo, this.categories, this.providers, this.storage);
    this.renderer = new RenderService(this.stories, sceneRepo, projectRepo, this.categories, this.providers, this.storage);
    this.jobs = new JobQueue(new JobRepository(this.db), config.workerConcurrency);
    this.registerJobHandlers();
  }

  private registerJobHandlers(): void {
    this.jobs
      .handle("generate-story", async (job, { report, enqueue }) => {
        const { storyId, render } = GenerateStoryJobSchema.parse(job.payload);
        report(0.1, "writing script");
        await this.stories.generateScript(storyId);
        if (render) enqueue("render-assets", { storyId });
      })
      .handle("render-assets", async (job, { report }) => {
        const { storyId, ...options } = RenderJobSchema.parse(job.payload);
        await this.renderer.render(storyId, options, report);
      })
      .handle("generate-batch", async (job, { report, enqueue }) => {
        const { projectId, category, count, settings, render } = BatchSchema.parse(job.payload);
        // Drafts reserve unique blueprints up front; each script is its own retryable job.
        const reserved = new Set<string>();
        for (let i = 0; i < count; i++) {
          const story = this.stories.createDraft(projectId, category, settings, reserved);
          enqueue("generate-story", { storyId: story.id, render });
          if (i % 25 === 0) report(i / count, `queued ${i}/${count}`);
        }
      });
  }
}
