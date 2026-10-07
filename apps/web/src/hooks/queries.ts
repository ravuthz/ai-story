import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const keys = {
  categories: ["categories"] as const,
  providers: ["providers"] as const,
  providerConfigs: ["provider-configs"] as const,
  providerDrivers: ["provider-drivers"] as const,
  voices: ["voices"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  stories: (q: object) => ["stories", q] as const,
  story: (id: string) => ["story", id] as const,
  jobs: ["jobs"] as const,
};

export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: api.categories });
export const useProviders = () => useQuery({ queryKey: keys.providers, queryFn: api.providers, staleTime: 60_000 });
export const useProviderConfigs = () => useQuery({ queryKey: keys.providerConfigs, queryFn: api.providerConfigs });
export const useProviderDrivers = () => useQuery({ queryKey: keys.providerDrivers, queryFn: api.providerDrivers, staleTime: Infinity });
export const useVoices = () => useQuery({ queryKey: keys.voices, queryFn: api.voices, staleTime: Infinity });
export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: api.projects });
export const useProject = (id: string) => useQuery({ queryKey: keys.project(id), queryFn: () => api.project(id) });
export const useStories = (q: Parameters<typeof api.stories>[0]) =>
  useQuery({ queryKey: keys.stories(q), queryFn: () => api.stories(q), placeholderData: (prev) => prev });
export const useStory = (id: string) => useQuery({ queryKey: keys.story(id), queryFn: () => api.story(id) });
export const useJobs = () => useQuery({ queryKey: keys.jobs, queryFn: api.jobs });

/**
 * One mutation helper for every write: toasts on success/failure and
 * invalidates the given query keys.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  { success, invalidate = [] }: { success?: string | ((r: TResult) => string); invalidate?: QueryKey[] } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      invalidate.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      if (success) toast.success(typeof success === "function" ? success(result) : success);
    },
    onError: (error) => toast.error(error.message),
  });
}
