import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Job } from "@/lib/api";
import { keys } from "./queries";

/** Subscribes to server-sent job events and refreshes affected queries. */
export function useJobEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    const source = new EventSource("/api/jobs/events");
    source.addEventListener("job", (event) => {
      const job = JSON.parse((event as MessageEvent).data) as Job;
      qc.invalidateQueries({ queryKey: keys.jobs });
      if (job.status === "done" || job.status === "failed" || job.status === "running") {
        const storyId = job.payload.storyId as string | undefined;
        if (storyId) qc.invalidateQueries({ queryKey: keys.story(storyId) });
        qc.invalidateQueries({ queryKey: ["stories"] });
        qc.invalidateQueries({ queryKey: keys.categories });
        qc.invalidateQueries({ queryKey: keys.projects });
      }
    });
    return () => source.close();
  }, [qc]);
}
