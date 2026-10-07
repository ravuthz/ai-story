import type { Category } from "../domain/categories/Category";
import { MOTION_TYPES, type StoryBlueprint, type StorySettings } from "../domain/types";

const LANGUAGE_NAMES = { km: "Khmer (ខ្មែរ, natural spoken Khmer script)", en: "English" } as const;

export interface GeneratedScene {
  text: string;
  narration: string;
  imagePrompt: string;
  motion: string;
}

export interface GeneratedStory {
  title: string;
  synopsis: string;
  moral: string;
  scenes: GeneratedScene[];
}

export const STORY_JSON_SCHEMA = {
  type: "object",
  required: ["title", "synopsis", "moral", "scenes"],
  properties: {
    title: { type: "string" },
    synopsis: { type: "string" },
    moral: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        required: ["text", "narration", "imagePrompt", "motion"],
        properties: {
          text: { type: "string" },
          narration: { type: "string" },
          imagePrompt: { type: "string" },
          motion: { type: "string", enum: [...MOTION_TYPES] },
        },
      },
    },
  },
} as const;

/** Builds the LLM prompt for a story from its category, blueprint and settings. */
export class StoryPromptBuilder {
  build(category: Category, blueprint: StoryBlueprint, settings: StorySettings): string {
    const perScene = Math.round(settings.durationSec / settings.sceneCount);
    // Rough speaking rates so narration fits each scene's duration.
    const words = settings.narrationLanguage === "km" ? Math.round(perScene * 2.2) : Math.round(perScene * 2.5);

    return `You are an award-winning ${category.label.toLowerCase()} writer creating a short narrated video story.

STORY SEEDS (must all be used, this combination makes the story unique):
- Theme: ${blueprint.theme}
- Setting: ${blueprint.setting}
- Main character: ${blueprint.protagonist}
- Twist / ending: ${blueprint.twist}
- Tone: ${blueprint.tone}

REQUIREMENTS:
- Category: ${category.label} — ${category.description}
- Exactly ${settings.sceneCount} scenes, about ${perScene} seconds each (total ~${settings.durationSec}s).
- "text": the scene in English (2-4 sentences).
- "narration": the voice-over for the scene in ${LANGUAGE_NAMES[settings.narrationLanguage]}, roughly ${words} words, meant to be read aloud.
- "imagePrompt": an English visual description for an image model — subject, action, environment, camera angle, lighting. No text in image. Keep character appearance consistent across scenes.
- "motion": one of ${MOTION_TYPES.join(", ")} matching the mood of the scene.
- "title", "synopsis" (1-2 sentences) and "moral" (one line, may be empty for horror) in English.
- Original content only; no real people.

Respond with ONLY a JSON object, no markdown, matching:
{"title": string, "synopsis": string, "moral": string, "scenes": [{"text": string, "narration": string, "imagePrompt": string, "motion": string}]}`;
  }

  imagePrompt(scenePrompt: string, style: string, categoryStyle: string): string {
    return `${scenePrompt}. Style: ${style}, ${categoryStyle}.`;
  }
}
