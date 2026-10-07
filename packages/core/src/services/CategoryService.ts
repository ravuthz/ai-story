import type { Database } from "../db/Database";
import { InputError } from "../db/repositories/BaseRepository";
import type { CategoryRecord, CategoryRepository } from "../db/repositories/CategoryRepository";
import type { CategoryDefinition, CategoryPools } from "../domain/categories/Category";
import type { CategoryRegistry } from "../domain/categories/CategoryRegistry";
import { CATALOG } from "../domain/categories/catalog";
import type { CreateCategoryInput, UpdateCategoryInput } from "../domain/schemas";
import {
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_STORY_PROMPT,
  IMAGE_PROMPT_PLACEHOLDERS,
  placeholdersIn,
  REQUIRED_SEED_PLACEHOLDERS,
  STORY_OUTPUT_CONTRACT,
  STORY_PROMPT_PLACEHOLDERS,
} from "../prompts/templates";
import { nowIso } from "../utils/text";

const POOL_KEYS: (keyof CategoryPools)[] = ["themes", "settings", "protagonists", "twists", "tones"];

/** Category configuration (seeds, style suggestions, prompt templates) stored in the database; keeps the registry in sync. */
export class CategoryService {
  constructor(
    private readonly repo: CategoryRepository,
    private readonly db: Database,
    private readonly registry: CategoryRegistry,
    private readonly storyCount: (categoryId: string) => number,
  ) {}

  /** Imports the built-in catalog once, then loads every category into the registry. */
  init(): void {
    this.db.runOnce("categories_seeded_v1", () =>
      CATALOG.forEach((def, i) => {
        if (this.repo.findById(def.id)) return;
        this.repo.insert({ ...def, builtIn: true, sortOrder: i, createdAt: nowIso(), updatedAt: nowIso() });
      }),
    );
    for (const record of this.repo.listOrdered()) this.registry.set(record);
  }

  list(): CategoryRecord[] {
    return this.repo.listOrdered();
  }

  get(id: string): CategoryRecord {
    return this.repo.getById(id);
  }

  /** Default templates and the placeholders each one understands (for the editor and "reset"). */
  templateDefaults() {
    return {
      storyPrompt: DEFAULT_STORY_PROMPT,
      imagePrompt: DEFAULT_IMAGE_PROMPT,
      storyPlaceholders: STORY_PROMPT_PLACEHOLDERS,
      imagePlaceholders: IMAGE_PROMPT_PLACEHOLDERS,
      requiredSeeds: [...REQUIRED_SEED_PLACEHOLDERS],
      outputContract: STORY_OUTPUT_CONTRACT,
    };
  }

  create(input: CreateCategoryInput): CategoryRecord {
    if (this.repo.findById(input.id)) throw new InputError(`A category "${input.id}" already exists`);
    const def = CategoryService.validate({
      id: input.id,
      label: input.label,
      emoji: input.emoji ?? "📖",
      description: input.description ?? "",
      imageStyle: input.imageStyle ?? "",
      pools: input.pools,
      styleSuggestions: input.styleSuggestions ?? [],
      storyPrompt: input.storyPrompt?.trim() || DEFAULT_STORY_PROMPT,
      imagePrompt: input.imagePrompt?.trim() || DEFAULT_IMAGE_PROMPT,
    });
    const sortOrder = Math.max(-1, ...this.repo.list().map((c) => c.sortOrder)) + 1;
    const record = this.repo.insert({ ...def, builtIn: false, sortOrder, createdAt: nowIso(), updatedAt: nowIso() });
    this.registry.set(record);
    return record;
  }

  update(id: string, patch: UpdateCategoryInput): CategoryRecord {
    const current = this.repo.getById(id);
    const def = CategoryService.validate({ ...current, ...patch, id });
    const record = this.repo.update(id, { ...def, updatedAt: nowIso() });
    this.registry.set(record);
    return record;
  }

  delete(id: string): void {
    this.repo.getById(id);
    const stories = this.storyCount(id);
    if (stories) throw new InputError(`This category has ${stories} stories; delete them before deleting the category`);
    if (this.repo.count() <= 1) throw new InputError("Keep at least one category");
    this.repo.delete(id);
    this.registry.remove(id);
  }

  /** Trims and de-duplicates lists and checks the templates keep what generation depends on. */
  private static validate(def: CategoryDefinition): CategoryDefinition {
    const clean = (items: string[]) => [...new Set(items.map((s) => s.trim()).filter(Boolean))];
    const pools = Object.fromEntries(POOL_KEYS.map((k) => [k, clean(def.pools[k] ?? [])])) as unknown as CategoryPools;
    for (const k of POOL_KEYS) if (!pools[k].length) throw new InputError(`Seeds: add at least one ${k.slice(0, -1)}`);

    const storyPrompt = def.storyPrompt.trim();
    const used = new Set(placeholdersIn(storyPrompt));
    const missing = REQUIRED_SEED_PLACEHOLDERS.filter((p) => !used.has(p));
    if (missing.length) {
      throw new InputError(`Story prompt must use every seed so stories stay unique; missing ${missing.map((p) => `{{${p}}}`).join(", ")}`);
    }
    const imagePrompt = def.imagePrompt.trim();
    if (!placeholdersIn(imagePrompt).includes("scenePrompt")) throw new InputError("Image prompt must include {{scenePrompt}}");

    return {
      ...def,
      label: def.label.trim(),
      emoji: def.emoji.trim() || "📖",
      description: def.description.trim(),
      imageStyle: def.imageStyle.trim(),
      pools,
      styleSuggestions: clean(def.styleSuggestions),
      storyPrompt,
      imagePrompt,
    };
  }
}
