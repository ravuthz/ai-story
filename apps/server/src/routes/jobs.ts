import type { App } from "@ai-story/core";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export const jobRoutes = (app: App) =>
  new Hono()
    .get("/", (c) => c.json({ counts: app.jobs.counts(), items: app.jobs.list(Number(c.req.query("limit")) || 100) }))
    .get("/events", (c) =>
      streamSSE(c, async (stream) => {
        const unsubscribe = app.jobs.subscribe((job) => void stream.writeSSE({ event: "job", data: JSON.stringify(job) }));
        stream.onAbort(unsubscribe);
        while (!stream.aborted) await stream.sleep(15_000).then(() => stream.writeSSE({ event: "ping", data: "" }));
      }),
    )
    .get("/:id", (c) => c.json(app.jobs.get(c.req.param("id"))));
