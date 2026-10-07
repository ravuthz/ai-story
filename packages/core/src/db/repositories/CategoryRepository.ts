import type { CategoryDefinition, CategoryPools } from "../../domain/categories/Category";
import { BaseRepository, pickColumns } from "./BaseRepository";

export type CategoryRecord = CategoryDefinition & { builtIn: boolean; sortOrder: number; createdAt: string; updatedAt: string };

export class CategoryRepository extends BaseRepository<CategoryRecord> {
  protected readonly table = "categories";

  listOrdered(): CategoryRecord[] {
    return this.list({ orderBy: "sort_order, label COLLATE NOCASE" });
  }

  protected toEntity(row: Record<string, unknown>): CategoryRecord {
    return {
      id: row.id as string,
      label: row.label as string,
      emoji: row.emoji as string,
      description: row.description as string,
      imageStyle: row.image_style as string,
      pools: JSON.parse(row.pools as string) as CategoryPools,
      styleSuggestions: JSON.parse(row.style_suggestions as string) as string[],
      storyPrompt: row.story_prompt as string,
      imagePrompt: row.image_prompt as string,
      builtIn: !!row.built_in,
      sortOrder: row.sort_order as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  protected toRow(c: Partial<CategoryRecord>) {
    return pickColumns<CategoryRecord>(c, {
      id: ["id"],
      label: ["label"],
      emoji: ["emoji"],
      description: ["description"],
      imageStyle: ["image_style"],
      pools: ["pools", (v) => JSON.stringify(v)],
      styleSuggestions: ["style_suggestions", (v) => JSON.stringify(v ?? [])],
      storyPrompt: ["story_prompt"],
      imagePrompt: ["image_prompt"],
      builtIn: ["built_in", (v) => (v ? 1 : 0)],
      sortOrder: ["sort_order"],
      createdAt: ["created_at"],
      updatedAt: ["updated_at"],
    });
  }
}
