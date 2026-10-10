export interface ErrorItem {
  id: string;
  title: string;
  step?: string;
  sceneIndex?: number;
  message: string;
}

/**
 * Parses raw error string into structured items with collapsible titles.
 * Formats scene-related errors into "Scene N: Error" (ex: Scene 18: Error).
 */
export function parseErrorItems(rawError?: string | null): ErrorItem[] {
  if (!rawError || !rawError.trim()) return [];

  const trimmed = rawError.trim();
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const sceneLineRegex = /^(?:([a-z]+):\s*)?scene\s*#?(\d+)[:\s—-]+(.*)$/i;
  const items: ErrorItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = line.match(sceneLineRegex);
    if (match) {
      const step = match[1]?.toLowerCase();
      const sceneNum = parseInt(match[2]!, 10);
      items.push({
        id: `scene-${sceneNum}-${i}`,
        title: `Scene ${sceneNum}: Error`,
        step,
        sceneIndex: sceneNum,
        message: line,
      });
    }
  }

  // If multiple distinct scene error lines were extracted, return them
  if (items.length > 1) {
    return items;
  }

  // If only 1 line matched or if the entire error text mentions a scene anywhere:
  const globalSceneMatch = trimmed.match(/(?:([a-z]+):\s*)?scene\s*#?(\d+)/i);
  if (globalSceneMatch) {
    const step = globalSceneMatch[1]?.toLowerCase();
    const sceneNum = parseInt(globalSceneMatch[2]!, 10);
    return [
      {
        id: `scene-${sceneNum}`,
        title: `Scene ${sceneNum}: Error`,
        step,
        sceneIndex: sceneNum,
        message: trimmed,
      },
    ];
  }

  // Fallback for general non-scene errors
  return [
    {
      id: "general-error",
      title: "Error",
      message: trimmed,
    },
  ];
}
