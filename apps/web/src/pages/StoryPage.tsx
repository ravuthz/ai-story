import { Clapperboard, Download, Film, Image, Mic, PenLine, Save, Scale, Trash2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryBadge, StatusBadge } from "@/components/app/badges";
import { SceneCard } from "@/components/app/SceneCard";
import { SettingsForm } from "@/components/app/SettingsForm";
import { PageHeader } from "@/components/app/Sidebar";
import { keys, useAction, useStory } from "@/hooks/queries";
import { href } from "@/hooks/useRoute";
import { api, fileUrl, type RenderStep, type SettingsInput } from "@/lib/api";
import { aspectOf } from "@/lib/aspect";

const RENDER_ACTIONS: { label: string; steps?: RenderStep[]; icon: typeof Film }[] = [
  { label: "Render all", icon: Wand2 },
  { label: "Images", steps: ["images"], icon: Image },
  { label: "Narration", steps: ["audios"], icon: Mic },
  { label: "Clips + final", steps: ["videos", "final"], icon: Clapperboard },
];

export function StoryPage({ id }: { id: string }) {
  const { data: story, isLoading } = useStory(id);
  const [settings, setSettings] = useState<SettingsInput>({});
  const [force, setForce] = useState(false);
  const [tab, setTab] = useState<"generation" | "final">("generation");
  useEffect(() => story && setSettings(story.settings), [story?.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = [keys.story(id)];
  const saveSettings = useAction((s: SettingsInput) => api.updateSettings(id, s), { success: "Settings saved", invalidate });
  const redistribute = useAction(() => api.redistribute(id), { success: "Durations re-split across scenes", invalidate });
  const regenerate = useAction(() => api.regenerate(id), { success: "Script regeneration queued", invalidate });
  const render = useAction((steps?: RenderStep[]) => api.render(id, { steps, force }), { success: "Render queued", invalidate });
  const remove = useAction(() => api.deleteStory(id), { success: "Story deleted", invalidate: [["stories"]] });

  if (isLoading || !story) return <Skeleton className="m-8 h-64" />;

  const busy = story.status === "generating" || story.status === "rendering";
  const hasScenes = story.scenes.length > 0;
  const finalVideo = fileUrl(story.videoPath, story.updatedAt);
  const { blueprint } = story;
  const { aspectRatio } = story.settings;
  const aspect = aspectOf(aspectRatio);
  const clipsDone = story.scenes.filter((s) => s.videoPath).length;

  return (
    <>
      <PageHeader
        title={story.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={story.category} />
            <StatusBadge status={story.status} />
            <a className="underline-offset-4 hover:underline" href={href.project(story.projectId)}>
              back to project
            </a>
          </span>
        }
        actions={
          <>
            <Button variant="outline" disabled={busy || regenerate.isPending} onClick={() => regenerate.mutate()}>
              <PenLine /> {hasScenes ? "Regenerate script" : "Generate script"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete story"
              onClick={() => confirm("Delete this story and its files?") && remove.mutate(undefined, { onSuccess: () => (window.location.hash = href.project(story.projectId)) })}
            >
              <Trash2 />
            </Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-6 p-8">
        <TabsList>
          <TabsTrigger value="generation">Generation</TabsTrigger>
          <TabsTrigger value="final">
            Final Video{finalVideo && <span className="ml-1 size-1.5 rounded-full bg-emerald-500" aria-label="ready" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generation">
          <div className="grid content-start gap-6">
            {story.error && <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{story.error}</p>}
            {story.synopsis && (
              <p className="text-sm leading-relaxed">
                {story.synopsis} {story.moral && <span className="text-muted-foreground">— {story.moral}</span>}
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Durations, scenes, narration language and providers for this story.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <SettingsForm value={settings} onChange={setSettings} category={story.category} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => saveSettings.mutate(settings)} disabled={saveSettings.isPending}>
                    <Save /> Save settings
                  </Button>
                  <Button variant="outline" onClick={() => redistribute.mutate()} disabled={!hasScenes}>
                    <Scale /> Split duration evenly
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Changing the scene count applies the next time the script is regenerated.</p>
              </CardContent>
            </Card>

            {hasScenes && (
              <div className="flex flex-wrap items-center gap-2">
                {RENDER_ACTIONS.map(({ label, steps, icon: Icon }) => (
                  <Button key={label} variant={steps ? "outline" : "default"} disabled={busy || render.isPending} onClick={() => render.mutate(steps)}>
                    <Icon /> {label}
                  </Button>
                ))}
                <div className="ml-2 flex items-center gap-2">
                  <Switch id="force" checked={force} onCheckedChange={setForce} />
                  <Label htmlFor="force">Overwrite existing</Label>
                </div>
              </div>
            )}

            {story.scenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} version={story.updatedAt} narrationLang={story.settings.narrationLanguage} aspectRatio={aspectRatio} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="final">
          <div className="flex flex-wrap items-start justify-center gap-6">
            <Card className={`w-full ${aspect.finalWidth}`}>
              <CardHeader>
                <CardTitle>Final video</CardTitle>
                <CardDescription>
                  {aspectRatio} · {clipsDone}/{story.scenes.length} scene clips rendered
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className={`flex ${aspect.box} items-center justify-center overflow-hidden rounded-md bg-black`}>
                  {finalVideo ? (
                    <video src={finalVideo} controls className="size-full object-contain" />
                  ) : (
                    <div className="grid justify-items-center gap-1 p-4 text-center text-sm text-white/60">
                      <Film className="size-8" />
                      Not rendered yet
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {finalVideo && (
                    <Button variant="outline" nativeButton={false} render={<a href={finalVideo} download={`${story.slug}.mp4`} />}>
                      <Download /> Download
                    </Button>
                  )}
                  <Button
                    variant={finalVideo ? "outline" : "default"}
                    disabled={!hasScenes || busy || render.isPending}
                    onClick={() => render.mutate(["videos", "final"])}
                  >
                    <Clapperboard /> {finalVideo ? "Re-render final" : "Render clips + final"}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card size="sm" className="w-full lg:w-80">
              <CardHeader>
                <CardTitle>Unique blueprint</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-sm">
                  {(["theme", "setting", "protagonist", "twist", "tone"] as const).map((k) => (
                    <div key={k} className="contents">
                      <dt className="capitalize text-muted-foreground">{k}</dt>
                      <dd>{blueprint[k]}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
