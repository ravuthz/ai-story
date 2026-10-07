import { useSyncExternalStore } from "react";

export type Route =
  | { page: "dashboard" }
  | { page: "project"; id: string }
  | { page: "story"; id: string }
  | { page: "jobs" }
  | { page: "providers" };

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

function parse(hash: string): Route {
  const [, page, id] = hash.replace(/^#/, "").split("/");
  if (page === "projects" && id) return { page: "project", id };
  if (page === "stories" && id) return { page: "story", id };
  if (page === "jobs") return { page: "jobs" };
  if (page === "providers") return { page: "providers" };
  return { page: "dashboard" };
}

/** Minimal hash router: #/projects/:id, #/stories/:id, #/jobs, #/providers */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parse(hash);
}

export const href = {
  dashboard: "#/",
  project: (id: string) => `#/projects/${id}`,
  story: (id: string) => `#/stories/${id}`,
  jobs: "#/jobs",
  providers: "#/providers",
};
