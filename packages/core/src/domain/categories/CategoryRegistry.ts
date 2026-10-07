import { Category } from "./Category";
import { CATALOG } from "./catalog";
import type { CategoryId } from "../types";

export class CategoryRegistry {
  private readonly categories = new Map<CategoryId, Category>();

  constructor(definitions = CATALOG) {
    for (const def of definitions) this.categories.set(def.id, new Category(def));
  }

  get(id: CategoryId): Category {
    const category = this.categories.get(id);
    if (!category) throw new Error(`Unknown category: ${id}`);
    return category;
  }

  list(): Category[] {
    return [...this.categories.values()];
  }
}

export const categoryRegistry = new CategoryRegistry();
