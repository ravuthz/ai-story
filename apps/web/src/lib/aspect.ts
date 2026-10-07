import type { StorySettings } from "@/lib/api";

type AspectRatio = StorySettings["aspectRatio"];

/** Tailwind classes per story aspect ratio (full literals so Tailwind picks them up). */
export const ASPECT: Record<AspectRatio, { box: string; sceneGrid: string; finalWidth: string }> = {
  "9:16": { box: "aspect-[9/16]", sceneGrid: "md:grid-cols-[220px_1fr]", finalWidth: "max-w-sm" },
  "1:1": { box: "aspect-square", sceneGrid: "md:grid-cols-[280px_1fr]", finalWidth: "max-w-xl" },
  "16:9": { box: "aspect-video", sceneGrid: "md:grid-cols-[380px_1fr]", finalWidth: "max-w-4xl" },
};

export const aspectOf = (ratio: AspectRatio | undefined) => ASPECT[ratio ?? "9:16"];
