import { ImageIcon, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { keys, useAction } from "@/hooks/queries";
import { api, fileUrl, type RenderStep, type Scene, type StorySettings } from "@/lib/api";
import { aspectOf } from "@/lib/aspect";
import { NumberField, SelectField, TextField } from "./fields";
import { CollapsibleError } from "./CollapsibleError";
import { parseErrorItems } from "@/lib/errorUtils";

const MOTIONS = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "pan-up-left",
  "pan-up-right",
  "pan-down-left",
  "pan-down-right",
  "zoom-in-left",
  "zoom-in-right",
].map((m) => ({ value: m, label: m }));
/**
 * CSS approximation of the FFmpeg motions: [translate x %, translate y %, scale] at the start and end of the clip.
 * The image is scaled 1.15×, so a ±7.5% shift pans edge to edge without showing the background.
 */
const Z = 1.15;
const E = ((Z - 1) / 2) * 100;
const MOTION_FRAMES: Record<Scene["motion"], [[number, number, number], [number, number, number]]> = {
  "zoom-in": [[0, 0, 1], [0, 0, Z]],
  "zoom-out": [[0, 0, Z], [0, 0, 1]],
  "pan-left": [[-E, 0, Z], [E, 0, Z]],
  "pan-right": [[E, 0, Z], [-E, 0, Z]],
  "pan-up": [[0, -E, Z], [0, E, Z]],
  "pan-down": [[0, E, Z], [0, -E, Z]],
  "pan-up-left": [[-E, -E, Z], [E, E, Z]],
  "pan-up-right": [[E, -E, Z], [-E, E, Z]],
  "pan-down-left": [[-E, E, Z], [E, -E, Z]],
  "pan-down-right": [[E, E, Z], [-E, -E, Z]],
  "zoom-in-left": [[0, 0, 1], [E, 0, Z]],
  "zoom-in-right": [[0, 0, 1], [-E, 0, Z]],
};

/** Loops the scene image through a motion, as the rendered clip will move. */
function MotionPreview({ src, alt, motion, durationSec }: { src: string; alt: string; motion: Scene["motion"]; durationSec: number }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const frames = MOTION_FRAMES[motion];
    if (!ref.current || !frames) return;
    const animation = ref.current.animate(
      frames.map(([x, y, s]) => ({ transform: `translate(${x}%, ${y}%) scale(${s})` })),
      { duration: Math.max(2, durationSec) * 1000, iterations: Infinity, easing: "linear" },
    );
    return () => animation.cancel();
  }, [motion, durationSec]);
  // object-cover: the clip fills the frame the same way (FFmpeg crops to the aspect ratio).
  return <img ref={ref} src={src} alt={alt} className="size-full object-cover" />;
}

const SCENE_STEPS = [
  { step: "images", label: "image" },
  { step: "audios", label: "audio" },
  { step: "subtitles", label: "subtitle" },
  { step: "videos", label: "video" },
] as const;
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
  // Live motion preview, shown while the motion dropdown is being changed; a saved/refreshed scene ends it.
  const [previewing, setPreviewing] = useState(false);
  const [storyTab, setStoryTab] = useState<"en" | "km">("en");
  useEffect(() => {
    setDraft(toDraft(scene));
    setPreviewing(false);
  }, [scene]);
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
            {previewing && image ? (
              <MotionPreview src={image} alt={`Scene ${scene.index + 1} motion preview`} motion={draft.motion} durationSec={draft.durationSec} />
            ) : video ? (
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
                {previewing && image ? `preview · ${draft.motion}` : `${video ? "clip" : "image"} · ${aspectRatio}`}
              </span>
            )}
            {previewing && image && (
              <Button size="icon-xs" variant="secondary" className="absolute top-1.5 right-1.5" aria-label="Close motion preview" onClick={() => setPreviewing(false)}>
                <X />
              </Button>
            )}
          </div>
          {audio && <audio src={audio} controls className="h-8 w-full" />}
          <div className="grid grid-cols-2 gap-1">
            {SCENE_STEPS.map(({ step, label }) => (
              // Re-running a step re-renders the clip too, so it picks up the new asset.
              <Button key={step} size="xs" variant="outline" disabled={rerender.isPending} onClick={() => rerender.mutate(step === "videos" ? [step] : [step, "videos"])}>
                <RefreshCw /> {label}
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
          <Tabs value={storyTab} onValueChange={(v) => setStoryTab(v as "en" | "km")} className="gap-2 max-h-[390px]">
            <TabsList className="w-full">
              <TabsTrigger value="km">Story Text Khmer</TabsTrigger>
              <TabsTrigger value="en">Story Text English</TabsTrigger>
            </TabsList>
            <TabsContent value="km" className="max-h-[300px] overflow-y-auto">
              <Textarea
                aria-label="Story Text Khmer"
                lang={narrationLang}
                value={draft.narration ?? ""}
                onChange={(e) => set("narration")(e.target.value)}
                placeholder="Story text in Khmer…"
                rows={3}
                className="max-h-[300px] overflow-y-auto"
              />
            </TabsContent>
            <TabsContent value="en" className="max-h-[300px] overflow-y-auto">
              <Textarea
                aria-label="Story Text English"
                value={draft.text ?? ""}
                onChange={(e) => set("text")(e.target.value)}
                placeholder="Story text in English…"
                rows={3}
                className="max-h-[300px] overflow-y-auto"
              />
            </TabsContent>
          </Tabs>
          <TextField label="Image prompt" value={draft.imagePrompt} onChange={set("imagePrompt")} multiline rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Motion"
              value={draft.motion}
              options={MOTIONS}
              onChange={(v) => {
                set("motion")(v as Scene["motion"]);
                setPreviewing(true);
              }}
              hint={image ? undefined : "Preview needs the scene image"}
            />
            <NumberField label="Duration (sec)" min={1} max={600} step={0.5} value={Number(draft.durationSec.toFixed(1))} onChange={set("durationSec")} hint="Extended automatically if narration is longer" hintPlacement="top" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
