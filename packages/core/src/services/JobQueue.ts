import type { JobRepository } from "../db/repositories/JobRepository";
import type { Job, JobType } from "../domain/types";
import { newId, nowIso } from "../utils/text";

export type JobContext = { report: (progress: number, message: string) => void; enqueue: JobQueue["enqueue"] };
export type JobHandler = (job: Job, ctx: JobContext) => Promise<unknown>;

type Listener = (job: Job) => void;

/**
 * SQLite-backed job queue. Jobs survive restarts (stale "running" jobs are
 * re-queued) and run with bounded concurrency.
 */
export class JobQueue {
  private readonly handlers = new Map<JobType, JobHandler>();
  private readonly listeners = new Set<Listener>();
  private running = 0;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly jobs: JobRepository, private readonly concurrency: number) {}

  handle(type: JobType, handler: JobHandler): this {
    this.handlers.set(type, handler);
    return this;
  }

  enqueue = (type: JobType, payload: Record<string, unknown>): Job => {
    const now = nowIso();
    const job = this.jobs.insert({ id: newId(), type, status: "queued", payload, progress: 0, message: "queued", error: null, createdAt: now, updatedAt: now });
    this.emit(job);
    queueMicrotask(() => this.pump());
    return job;
  };

  list(limit = 100) {
    return this.jobs.list({ orderBy: "created_at DESC", limit });
  }

  get(id: string) {
    return this.jobs.getById(id);
  }

  counts(): Record<string, number> {
    return Object.fromEntries(["queued", "running", "done", "failed"].map((s) => [s, this.jobs.count({ status: s })]));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(pollMs = 2000): void {
    this.jobs.requeueStale();
    this.timer = setInterval(() => this.pump(), pollMs);
    this.pump();
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private pump(): void {
    while (this.running < this.concurrency) {
      const job = this.jobs.claimNext();
      if (!job) return;
      this.running++;
      this.emit(job);
      this.execute(job).finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  private async execute(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    const update = (patch: Partial<Job>) => this.emit(this.jobs.update(job.id, { ...patch, updatedAt: nowIso() }));
    try {
      if (!handler) throw new Error(`No handler for job type ${job.type}`);
      await handler(job, {
        report: (progress, message) => update({ progress, message }),
        enqueue: this.enqueue,
      });
      update({ status: "done", progress: 1, message: "done" });
    } catch (error) {
      update({ status: "failed", error: (error as Error).message, message: "failed" });
    }
  }

  private emit(job: Job): void {
    for (const listener of this.listeners) listener(job);
  }
}
