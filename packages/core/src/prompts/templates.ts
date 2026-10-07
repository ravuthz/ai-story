import { MOTION_TYPES } from "../domain/types";

/** Placeholders available in a category's story prompt template. */
export const STORY_PROMPT_PLACEHOLDERS: Record<string, string> = {
  theme: "Blueprint seed: theme",
  setting: "Blueprint seed: setting",
  protagonist: "Blueprint seed: main character",
  twist: "Blueprint seed: twist / ending",
  tone: "Blueprint seed: tone",
  categoryLabel: "Category label, e.g. Horror Story",
  categoryLabelLower: "Category label in lower case",
  categoryDescription: "Category description",
  sceneCount: "Number of scenes",
  perSceneSec: "Seconds per scene",
  durationSec: "Total duration in seconds",
  narrationLanguage: "Narration language, e.g. Khmer (ខ្មែរ, …)",
  narrationWords: "Target words of narration per scene",
  motions: "Allowed camera motions",
};

/** The seeds that make every story unique; a story template must use all of them. */
export const REQUIRED_SEED_PLACEHOLDERS = ["theme", "setting", "protagonist", "twist", "tone"] as const;

/** Placeholders available in a category's image prompt template. */
export const IMAGE_PROMPT_PLACEHOLDERS: Record<string, string> = {
  scenePrompt: "The scene's image prompt (required)",
  style: "The story's image style setting",
  categoryStyle: "The category's image style",
};

export const DEFAULT_STORY_PROMPT = `You are an award-winning {{categoryLabelLower}} writer creating a short narrated video story.

STORY SEEDS (must all be used, this combination makes the story unique):
- Theme: {{theme}}
- Setting: {{setting}}
- Main character: {{protagonist}}
- Twist / ending: {{twist}}
- Tone: {{tone}}

REQUIREMENTS:
- Category: {{categoryLabel}} — {{categoryDescription}}
- Exactly {{sceneCount}} scenes, about {{perSceneSec}} seconds each (total ~{{durationSec}}s).
- "text": the scene in English (2-4 sentences).
- "narration": the voice-over for the scene in {{narrationLanguage}}, roughly {{narrationWords}} words, meant to be read aloud.
- "imagePrompt": an English visual description for an image model — subject, action, environment, camera angle, lighting. No text in image. Keep character appearance consistent across scenes.
- "motion": one of {{motions}} matching the mood of the scene.
- "title", "synopsis" (1-2 sentences) and "moral" (one line, may be empty for horror) in English.
- Original content only; no real people.`;

export const DEFAULT_IMAGE_PROMPT = "{{scenePrompt}}. Style: {{style}}, {{categoryStyle}}.";

/**
 * Always appended to the story prompt (not editable): the script parser depends on this exact shape.
 */
export const STORY_OUTPUT_CONTRACT = `Respond with ONLY a JSON object, no markdown, matching:
{"title": string, "synopsis": string, "moral": string, "scenes": [{"text": string, "narration": string, "imagePrompt": string, "motion": string}]}`;

/** Replaces {{key}} with vars[key]; unknown placeholders are left as-is so mistakes stay visible. */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Placeholder names used in a template. */
export const placeholdersIn = (template: string): string[] => [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);

export const MOTION_LIST = MOTION_TYPES.join(", ");
