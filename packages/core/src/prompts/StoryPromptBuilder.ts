import type { Category } from "../domain/categories/Category";
import { MOTION_LIST, renderTemplate, STORY_OUTPUT_CONTRACT } from "./templates";
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

/** Builds the LLM prompts from the category's templates, the story's blueprint and its settings. */
export class StoryPromptBuilder {
  build(category: Category, blueprint: StoryBlueprint, settings: StorySettings): string {
    const perScene = Math.round(settings.durationSec / settings.sceneCount);
    // Rough speaking rates so narration fits each scene's duration.
    const words = settings.narrationLanguage === "km" ? Math.round(perScene * 2.2) : Math.round(perScene * 2.5);
    const body = renderTemplate(category.storyPrompt, {
      theme: blueprint.theme,
      setting: blueprint.setting,
      protagonist: blueprint.protagonist,
      twist: blueprint.twist,
      tone: blueprint.tone,
      categoryLabel: category.label,
      categoryLabelLower: category.label.toLowerCase(),
      categoryDescription: category.description,
      sceneCount: settings.sceneCount,
      perSceneSec: perScene,
      durationSec: settings.durationSec,
      narrationLanguage: LANGUAGE_NAMES[settings.narrationLanguage],
      narrationWords: words,
      motions: MOTION_LIST,
    });
    return `${body.trim()}\n\n${STORY_OUTPUT_CONTRACT}`;
  }

  imagePrompt(scenePrompt: string, style: string, category: Category): string {
    return renderTemplate(category.imagePrompt, { scenePrompt, style, categoryStyle: category.imageStyle });
  }
}
