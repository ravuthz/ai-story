import type { CategoryPools } from "@/lib/api";

/** Marks JSON copied from a category form; pasted JSON may omit it. */
export const CATEGORY_JSON_FORMAT = "ai-story-category@1";

export const POOL_KEYS: (keyof CategoryPools)[] = ["themes", "settings", "protagonists", "twists", "tones"];

export interface CategoryJson {
  format?: string;
  id?: string;
  label: string;
  emoji: string;
  description: string;
  imageStyle: string;
  pools: CategoryPools;
  styleSuggestions: string[];
  storyPrompt: string;
  imagePrompt: string;
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const placeholders = (t: string) => new Set([...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
const clean = (items: string[]) => [...new Set(items.map((s) => s.trim()).filter(Boolean))];

/**
 * Parses pasted text as a category, applying the same rules the server enforces on save.
 * Returns the category, or every problem found so they can all be fixed at once.
 */
export function parseCategoryJson(text: string, requiredSeeds: string[]): { ok: true; value: CategoryJson } | { ok: false; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Clipboard does not contain valid JSON"] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, errors: ["Expected a JSON object"] };
  const d = data as Record<string, unknown>;
  const errors: string[] = [];
  const str = (key: string, { required = false, max = 20000 } = {}) => {
    const v = d[key];
    if (v === undefined || v === null) {
      if (required) errors.push(`"${key}" is required`);
      return "";
    }
    if (typeof v !== "string") errors.push(`"${key}" must be text`);
    else if (v.length > max) errors.push(`"${key}" is longer than ${max} characters`);
    else if (required && !v.trim()) errors.push(`"${key}" can't be empty`);
    return typeof v === "string" ? v : "";
  };

  if (d.format !== undefined && d.format !== CATEGORY_JSON_FORMAT) errors.push(`Unknown "format" ${JSON.stringify(d.format)}; expected "${CATEGORY_JSON_FORMAT}"`);
  const id = d.id === undefined ? undefined : str("id");
  if (id !== undefined && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) errors.push(`"id" must be lowercase letters, digits and - (max 40)`);
  const label = str("label", { required: true, max: 80 });
  const emoji = str("emoji", { max: 16 });
  const description = str("description", { max: 1000 });
  const imageStyle = str("imageStyle", { max: 1000 });
  const storyPrompt = str("storyPrompt", { required: true });
  const imagePrompt = str("imagePrompt", { required: true, max: 4000 });

  const pools = {} as CategoryPools;
  const rawPools = d.pools;
  if (!rawPools || typeof rawPools !== "object" || Array.isArray(rawPools)) errors.push(`"pools" must be an object with ${POOL_KEYS.join(", ")}`);
  else {
    for (const key of POOL_KEYS) {
      const list = (rawPools as Record<string, unknown>)[key];
      if (!isStringList(list)) errors.push(`"pools.${key}" must be a list of text`);
      else if (!clean(list).length) errors.push(`"pools.${key}" needs at least one entry`);
      pools[key] = isStringList(list) ? clean(list) : [];
    }
  }
  const styles = d.styleSuggestions ?? [];
  if (!isStringList(styles)) errors.push(`"styleSuggestions" must be a list of text`);

  const used = placeholders(storyPrompt);
  const missing = requiredSeeds.filter((p) => !used.has(p));
  if (storyPrompt && missing.length) errors.push(`"storyPrompt" must use ${missing.map((p) => `{{${p}}}`).join(", ")}`);
  if (imagePrompt && !placeholders(imagePrompt).has("scenePrompt")) errors.push(`"imagePrompt" must include {{scenePrompt}}`);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      label: label.trim(),
      emoji: emoji.trim() || "📖",
      description,
      imageStyle,
      pools,
      styleSuggestions: clean(styles as string[]),
      storyPrompt,
      imagePrompt,
    },
  };
}
