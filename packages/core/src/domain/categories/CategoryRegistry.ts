import { NotFoundError } from "../../db/repositories/BaseRepository";
import { Category, type CategoryDefinition } from "./Category";
import type { CategoryId } from "../types";

/** Live categories, kept in sync with the `categories` table by CategoryService. */
export class CategoryRegistry {
  private readonly categories = new Map<CategoryId, Category>();

  constructor(definitions: CategoryDefinition[] = []) {
    definitions.forEach((def) => this.set(def));
  }

  set(def: CategoryDefinition): this {
    this.categories.set(def.id, new Category(def));
    return this;
  }

  remove(id: CategoryId): void {
    this.categories.delete(id);
  }

  get(id: CategoryId): Category {
    const category = this.categories.get(id);
    if (!category) throw new NotFoundError(`Unknown category: ${id}`);
    return category;
  }

  list(): Category[] {
    return [...this.categories.values()];
  }
}
