import { Clapperboard, Film, Image, Mic, PenLine, Save, Scale, Trash2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { CategoryBadge, StatusBadge } from "@/components/app/badges";
import { SceneCard } from "@/components/app/SceneCard";
import { SettingsForm } from "@/components/app/SettingsForm";
import { PageHeader } from "@/components/app/Sidebar";
import { keys, useAction, useStory } from "@/hooks/queries";
import { href } from "@/hooks/useRoute";
import { api, fileUrl, type RenderStep, type SettingsInput } from "@/lib/api";

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
      <div className="grid gap-6 p-8 xl:grid-cols-[1fr_380px]">
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
              <SettingsForm value={settings} onChange={setSettings} />
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
            <SceneCard key={scene.id} scene={scene} version={story.updatedAt} narrationLang={story.settings.narrationLanguage} />
          ))}
        </div>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Final video</CardTitle>
            </CardHeader>
            <CardContent>
              {finalVideo ? (
                <video src={finalVideo} controls className="w-full rounded-md bg-black" />
              ) : (
                <p className="text-sm text-muted-foreground">Not rendered yet.</p>
              )}
            </CardContent>
          </Card>
          <Card size="sm">
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
        </aside>
      </div>
    </>
  );
}
