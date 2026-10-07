import { createHash } from "node:crypto";
import type { Category } from "./categories/Category";
import type { StoryBlueprint } from "./types";

/** Lookup for fingerprints already persisted, so blueprints are never reused. */
export interface FingerprintStore {
  hasFingerprint(fingerprint: string): boolean;
}

/**
 * Produces unique story blueprints by walking the category's combination space
 * in a pseudo-random order (random start + step coprime with capacity), which
 * visits every combination exactly once before repeating.
 */
export class BlueprintGenerator {
  constructor(private readonly store: FingerprintStore) {}

  static fingerprint(category: string, seeds: Record<string, string>): string {
    const raw = [category, ...Object.keys(seeds).sort().map((k) => seeds[k])].join("|");
    return createHash("sha1").update(raw).digest("hex");
  }

  next(category: Category, reserved = new Set<string>()): StoryBlueprint {
    const capacity = category.capacity;
    const start = Math.floor(Math.random() * capacity);
    const step = BlueprintGenerator.coprimeStep(capacity);

    for (let i = 0; i < capacity; i++) {
      const seeds = category.seedsAt((start + i * step) % capacity);
      const fingerprint = BlueprintGenerator.fingerprint(category.id, seeds);
      if (reserved.has(fingerprint) || this.store.hasFingerprint(fingerprint)) continue;
      reserved.add(fingerprint);
      return {
        category: category.id,
        theme: seeds.themes,
        setting: seeds.settings,
        protagonist: seeds.protagonists,
        twist: seeds.twists,
        tone: seeds.tones,
        fingerprint,
      };
    }
    throw new Error(`Category "${category.id}" exhausted all ${capacity} unique blueprints`);
  }

  private static coprimeStep(n: number): number {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    let step = Math.floor(n * 0.618) || 1;
    while (gcd(step, n) !== 1) step++;
    return step;
  }
}
