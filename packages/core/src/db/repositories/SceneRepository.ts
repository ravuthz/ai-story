import type { Scene } from "../../domain/types";
import { BaseRepository, pickColumns } from "./BaseRepository";

export class SceneRepository extends BaseRepository<Scene> {
  protected readonly table = "scenes";

  listByStory(storyId: string): Scene[] {
    return this.list({ where: { story_id: storyId }, orderBy: "idx" });
  }

  replaceForStory(storyId: string, scenes: Scene[]): Scene[] {
    return this.db.transaction(() => {
      this.db.sql.query("DELETE FROM scenes WHERE story_id = $storyId").run({ storyId });
      return scenes.map((scene) => this.insert(scene));
    });
  }

  protected toEntity(row: Record<string, unknown>): Scene {
    return {
      id: row.id as string,
      storyId: row.story_id as string,
      index: row.idx as number,
      text: row.text as string,
      narration: row.narration as string,
      imagePrompt: row.image_prompt as string,
      motion: row.motion as Scene["motion"],
      durationSec: row.duration_sec as number,
      imagePath: (row.image_path as string | null) ?? null,
      audioPath: (row.audio_path as string | null) ?? null,
      subtitlePath: (row.subtitle_path as string | null) ?? null,
      videoPath: (row.video_path as string | null) ?? null,
    };
  }

  protected toRow(s: Partial<Scene>) {
    return pickColumns<Scene>(s, {
      id: ["id"],
      storyId: ["story_id"],
      index: ["idx"],
      text: ["text"],
      narration: ["narration"],
      imagePrompt: ["image_prompt"],
      motion: ["motion"],
      durationSec: ["duration_sec"],
      imagePath: ["image_path"],
      audioPath: ["audio_path"],
      subtitlePath: ["subtitle_path"],
      videoPath: ["video_path"],
    });
  }
}
