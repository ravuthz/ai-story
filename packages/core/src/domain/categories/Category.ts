import type { CategoryId } from "../types";

export interface CategoryPools {
  themes: string[];
  settings: string[];
  protagonists: string[];
  twists: string[];
  tones: string[];
}

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  description: string;
  imageStyle: string;
  pools: CategoryPools;
}

export type BlueprintSeeds = Record<keyof CategoryPools, string>;

export class Category {
  constructor(private readonly def: CategoryDefinition) {}

  get id(): CategoryId {
    return this.def.id;
  }
  get label(): string {
    return this.def.label;
  }
  get description(): string {
    return this.def.description;
  }
  get imageStyle(): string {
    return this.def.imageStyle;
  }
  get pools(): CategoryPools {
    return this.def.pools;
  }

  /** Total number of unique blueprints this category can produce. */
  get capacity(): number {
    return Object.values(this.def.pools).reduce((acc, pool) => acc * pool.length, 1);
  }

  /** Decodes a combination index (0..capacity-1) into one seed per pool (mixed-radix). */
  seedsAt(index: number): BlueprintSeeds {
    let rest = index;
    const pick = (pool: string[]): string => {
      const value = pool[rest % pool.length]!;
      rest = Math.floor(rest / pool.length);
      return value;
    };
    const { themes, settings, protagonists, twists, tones } = this.def.pools;
    return {
      themes: pick(themes),
      settings: pick(settings),
      protagonists: pick(protagonists),
      twists: pick(twists),
      tones: pick(tones),
    };
  }

  toJSON() {
    return { ...this.def, capacity: this.capacity };
  }
}
