import type { CategoryId, Job, Project, ProviderRecord, Scene, Story, StorySettings, Voice } from "@ai-story/core/types";

export type { CategoryId, Job, Project, ProviderRecord, Scene, Story, StorySettings, Voice };
export type StoryWithScenes = Story & { scenes: Scene[] };
export type RenderStep = "images" | "audios" | "videos" | "final" | "subtitles";
export type SettingsInput = Partial<StorySettings>;

export interface CategoryPools {
  themes: string[];
  settings: string[];
  protagonists: string[];
  twists: string[];
  tones: string[];
}
export interface CategoryInfo {
  id: CategoryId;
  label: string;
  emoji: string;
  description: string;
  imageStyle: string;
  pools: CategoryPools;
  /** Image-style chips suggested in story settings. */
  styleSuggestions: string[];
  storyPrompt: string;
  imagePrompt: string;
  builtIn: boolean;
  /** Unique blueprints the seeds allow. */
  capacity: number;
  /** Stories in this category. */
  count: number;
}
export type CategoryInput = Partial<Omit<CategoryInfo, "builtIn" | "capacity" | "count">>;
export interface TemplateDefaults {
  storyPrompt: string;
  imagePrompt: string;
  storyPlaceholders: Record<string, string>;
  imagePlaceholders: Record<string, string>;
  requiredSeeds: string[];
  outputContract: string;
}
export interface ProviderInfo {
  id: string;
  kind: "text" | "image" | "audio" | "video";
  label: string;
  available: boolean;
  detail?: string;
}
export type ProviderKind = ProviderInfo["kind"];
export interface DriverField {
  key: string;
  label: string;
  type: "text" | "secret" | "number" | "json" | "list" | "connections";
  hidden?: boolean;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}
export interface ProviderDriver {
  type: string;
  kind: ProviderKind;
  label: string;
  description: string;
  fields: DriverField[];
}
export type ProviderConfig = ProviderRecord & { available: boolean; detail?: string; driverLabel: string };
export interface ProviderInput {
  type: string;
  slug: string;
  label?: string;
  enabled?: boolean;
  isDefault?: boolean;
  config?: Record<string, unknown>;
}
export interface VoiceOptions {
  /** The audio provider the choices belong to (the default one when the story doesn't pick one). */
  providerId: string | null;
  /** True when voices are user-uploaded reference clips that can be managed. */
  cloning: boolean;
  /** `mode` is set for custom voices (cloned / designed). */
  voices: { value: string; label: string; mode?: Voice["mode"] }[];
  /** The provider's own default voice (set in its voices dialog), used when a story doesn't choose. */
  defaultVoice: (DefaultVoice & { voiceName?: string }) | null;
}
/** A provider's default narration voice: a selected clone, or a voice description. */
export interface DefaultVoice {
  mode: Voice["mode"];
  voiceId?: string;
  description?: string;
}
export interface VoiceInput {
  name?: string;
  mode?: Voice["mode"];
  transcript?: string;
  style?: string;
  file?: File;
}
export interface Page<T> {
  total: number;
  items: T[];
}

class ApiError extends Error {}

/** Thin typed wrapper over the REST API. */
class ApiClient {
  private readonly base: string;

  constructor(base = "/api") {
    this.base = base;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // FormData (file uploads) sets its own multipart content type.
    const isForm = body instanceof FormData;
    const res = await fetch(this.base + path, {
      method,
      headers: body && !isForm ? { "content-type": "application/json" } : undefined,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? res.statusText);
    return data as T;
  }

  private qs(params: Record<string, string | number | undefined>) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
    return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
  }

  categories = () => this.request<CategoryInfo[]>("GET", "/categories");
  templateDefaults = () => this.request<TemplateDefaults>("GET", "/categories/template-defaults");
  createCategory = (body: CategoryInput) => this.request<CategoryInfo>("POST", "/categories", body);
  updateCategory = ({ id, ...body }: CategoryInput & { id: string }) => this.request<CategoryInfo>("PATCH", `/categories/${id}`, body);
  deleteCategory = (id: string) => this.request<void>("DELETE", `/categories/${id}`);
  providers = () => this.request<{ defaults: Record<string, string>; providers: ProviderInfo[] }>("GET", "/providers");
  providerConfigs = () => this.request<ProviderConfig[]>("GET", "/provider-configs");
  providerDrivers = () => this.request<ProviderDriver[]>("GET", "/provider-configs/drivers");
  createProvider = (body: ProviderInput) => this.request<ProviderRecord>("POST", "/provider-configs", body);
  updateProvider = ({ id, ...body }: { id: string; label?: string; enabled?: boolean; config?: Record<string, unknown> }) =>
    this.request<ProviderRecord>("PATCH", `/provider-configs/${id}`, body);
  setDefaultProvider = (id: string) => this.request<ProviderRecord>("POST", `/provider-configs/${id}/default`);
  deleteProvider = (id: string) => this.request<void>("DELETE", `/provider-configs/${id}`);
  voiceOptions = (q: { audio?: string; language: string }) => this.request<VoiceOptions>("GET", `/voices${this.qs(q)}`);
  providerVoices = (providerId: string) => this.request<Voice[]>("GET", `/voices/provider/${providerId}`);
  createVoice = ({ providerId, ...input }: VoiceInput & { providerId: string }) =>
    this.request<Voice>("POST", `/voices/provider/${providerId}`, ApiClient.voiceForm(input));
  updateVoice = ({ id, ...input }: VoiceInput & { id: string }) => this.request<Voice>("PATCH", `/voices/${id}`, ApiClient.voiceForm(input));
  deleteVoice = (id: string) => this.request<void>("DELETE", `/voices/${id}`);
  setDefaultVoice = ({ providerId, ...body }: DefaultVoice & { providerId: string }) =>
    this.request<ProviderRecord>("POST", `/voices/provider/${providerId}/default`, body);
  previewVoice = ({ providerId, ...body }: DefaultVoice & { providerId: string; text: string; language?: string }) =>
    this.request<{ filePath: string }>("POST", `/voices/provider/${providerId}/preview`, body);

  private static voiceForm({ file, ...fields }: VoiceInput): FormData {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.set(k, v);
    if (file) form.set("file", file);
    return form;
  }

  projects = () => this.request<(Project & { storyCount: number })[]>("GET", "/projects");
  project = (id: string) => this.request<Project>("GET", `/projects/${id}`);
  createProject = (body: { name: string; description?: string }) => this.request<Project>("POST", "/projects", body);
  deleteProject = (id: string) => this.request<void>("DELETE", `/projects/${id}`);

  stories = (q: { projectId?: string; category?: string; status?: string; limit?: number; offset?: number }) =>
    this.request<Page<Story>>("GET", `/stories${this.qs(q)}`);
  story = (id: string) => this.request<StoryWithScenes>("GET", `/stories/${id}`);
  createStory = (body: { projectId: string; category: CategoryId; settings?: SettingsInput; render?: boolean; script?: string; title?: string }) =>
    this.request<{ story: Story; job: Job }>("POST", "/stories", body);
  batch = (body: { projectId: string; category: CategoryId; count: number; settings?: SettingsInput; render?: boolean }) =>
    this.request<{ job: Job }>("POST", "/stories/batch", body);
  updateSettings = (id: string, body: SettingsInput) => this.request<Story>("PATCH", `/stories/${id}/settings`, body);
  redistribute = (id: string) => this.request<Scene[]>("POST", `/stories/${id}/redistribute`);
  regenerate = (id: string) => this.request<{ job: Job }>("POST", `/stories/${id}/generate`);
  render = (id: string, body: { steps?: RenderStep[]; force?: boolean; sceneIds?: string[] } = {}) =>
    this.request<{ job: Job }>("POST", `/stories/${id}/render`, body);
  deleteStory = (id: string) => this.request<void>("DELETE", `/stories/${id}`);
  updateScene = (id: string, body: Partial<Pick<Scene, "text" | "narration" | "imagePrompt" | "motion" | "durationSec">>) =>
    this.request<Scene>("PATCH", `/scenes/${id}`, body);

  jobs = () => this.request<{ counts: Record<string, number>; items: Job[] }>("GET", "/jobs");
}

export const api = new ApiClient();

/** URL for a stored asset path (relative to the storage root). */
export const fileUrl = (path: string | null, version?: string) =>
  path ? `/files/${path.split("/").map(encodeURIComponent).join("/")}${version ? `?v=${encodeURIComponent(version)}` : ""}` : undefined;
