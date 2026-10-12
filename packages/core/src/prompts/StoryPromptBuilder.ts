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

  /** Adapts a user-written script into scenes: the author's words are the narration, nothing new is invented. */
  fromScript(category: Category, settings: StorySettings, script: string, title?: string): string {
    const perScene = Math.round(settings.durationSec / settings.sceneCount);
    const language = LANGUAGE_NAMES[settings.narrationLanguage];
    return `You are adapting a script written by the user into a narrated ${category.label.toLowerCase()} video.

Split the script below into exactly ${settings.sceneCount} consecutive scenes of about ${perScene} seconds each, in the script's order.
- "narration": the script's own words for that scene, in ${language}. Keep the author's wording; only translate faithfully if the script is written in another language. Together the scenes must cover the whole script, without adding, skipping or summarising.
- "text": the same passage in English.
- "imagePrompt": an English description of one vivid still image for the scene (subject, setting, lighting, camera), with no text or captions in the image. Keep recurring characters and places visually consistent.
- "motion": one of ${MOTION_LIST}, matching the scene's mood.
- "title": ${title ? `exactly "${title.replace(/"/g, "'")}"` : "a short title for the script"}. "synopsis": 1-2 sentences. "moral": the script's message in one sentence (empty string if none).

<script>
${script.trim()}
</script>

${STORY_OUTPUT_CONTRACT}`;
  }

  imagePrompt(scenePrompt: string, style: string, category: Category): string {
    return renderTemplate(category.imagePrompt, { scenePrompt, style, categoryStyle: category.imageStyle });
  }
}
