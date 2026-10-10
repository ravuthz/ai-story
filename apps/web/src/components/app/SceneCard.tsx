import { ImageIcon, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { keys, useAction } from "@/hooks/queries";
import { api, fileUrl, type RenderStep, type Scene, type StorySettings } from "@/lib/api";
import { aspectOf } from "@/lib/aspect";
import { NumberField, SelectField, TextField } from "./fields";
import { CollapsibleError } from "./CollapsibleError";
import { parseErrorItems } from "@/lib/errorUtils";

const MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"].map((m) => ({ value: m, label: m }));
type Draft = Pick<Scene, "text" | "narration" | "imagePrompt" | "motion" | "durationSec">;
const toDraft = ({ text, narration, imagePrompt, motion, durationSec }: Scene): Draft => ({ text, narration, imagePrompt, motion, durationSec });

/** One scene: media previews (shaped like the story's aspect ratio) + editable script, with per-scene re-render. */
export function SceneCard({
  scene,
  version,
  narrationLang,
  aspectRatio,
  storyError,
}: {
  scene: Scene;
  version: string;
  narrationLang: string;
  aspectRatio: StorySettings["aspectRatio"];
  storyError?: string | null;
}) {
  const aspect = aspectOf(aspectRatio);
  const sceneErrorItem = parseErrorItems(storyError).find(
    (item) => item.sceneIndex === scene.index + 1
  );
  const [draft, setDraft] = useState<Draft>(() => toDraft(scene));
  useEffect(() => setDraft(toDraft(scene)), [scene]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(scene));
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const invalidate = [keys.story(scene.storyId)];
  const save = useAction((d: Draft) => api.updateScene(scene.id, d), { success: "Scene saved", invalidate });
  const rerender = useAction((steps: RenderStep[]) => api.render(scene.storyId, { steps, force: true, sceneIds: [scene.id] }), {
    success: "Re-render queued",
  });

  const image = fileUrl(scene.imagePath, version);
  const audio = fileUrl(scene.audioPath, version);
  const video = fileUrl(scene.videoPath, version);

  return (
    <Card>
      <CardContent className={`grid gap-4 ${aspect.sceneGrid}`}>
        <div className="grid content-start gap-2">
          {/* object-contain: media rendered at an older aspect ratio is shown whole (letterboxed), not cropped. */}
          <div className={`relative flex ${aspect.box} items-center justify-center overflow-hidden rounded-md bg-muted`}>
            {video ? (
              <video src={video} poster={image} controls className="size-full bg-black object-contain" />
            ) : image ? (
              <img src={image} alt={`Scene ${scene.index + 1}`} className="size-full object-contain" />
            ) : (
              <div className="grid justify-items-center gap-1 text-muted-foreground">
                <ImageIcon className="size-8" />
                <span className="text-xs">{aspectRatio}</span>
              </div>
            )}
            {(image || video) && (
              <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {video ? "clip" : "image"} · {aspectRatio}
              </span>
            )}
          </div>
          {audio && <audio src={audio} controls className="h-8 w-full" />}
          <div className="grid grid-cols-3 gap-1">
            {(["images", "audios", "videos"] as const).map((step) => (
              <Button key={step} size="xs" variant="outline" disabled={rerender.isPending} onClick={() => rerender.mutate([step, ...(step !== "videos" ? (["videos"] as const) : [])])}>
                <RefreshCw /> {step.slice(0, -1)}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid content-start gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Scene {scene.index + 1}</h3>
            <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
              <Save /> Save
            </Button>
          </div>
          {sceneErrorItem && <CollapsibleError error={sceneErrorItem.message} />}
          <TextField label="Story text (English)" value={draft.text} onChange={set("text")} multiline rows={2} />
          <TextField label={`Narration (${narrationLang})`} lang={narrationLang} value={draft.narration} onChange={set("narration")} multiline rows={3} />
          <TextField label="Image prompt" value={draft.imagePrompt} onChange={set("imagePrompt")} multiline rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Motion" value={draft.motion} options={MOTIONS} onChange={(v) => set("motion")(v as Scene["motion"])} />
            <NumberField label="Duration (sec)" min={1} max={600} step={0.5} value={Number(draft.durationSec.toFixed(1))} onChange={set("durationSec")} hint="Extended automatically if narration is longer" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
