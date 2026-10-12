import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction, useCategories } from "@/hooks/queries";
import { href } from "@/hooks/useRoute";
import { api, type CategoryId, type SettingsInput } from "@/lib/api";
import { SelectField, TextField } from "./fields";
import { FormDialog } from "./FormDialog";
import { DEFAULT_SETTINGS, SettingsForm } from "./SettingsForm";

const MIN_SCRIPT = 20;

/**
 * One custom story from your own script. The script is split into scenes (your words become the
 * narration, image prompts are written for you); afterwards it works like any generated story,
 * and "Regenerate script" re-splits the same script.
 */
export function CreateStoryDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useCategories();
  const [category, setCategory] = useState<CategoryId>("horror-story");
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [render, setRender] = useState(true);
  const [settings, setSettings] = useState<SettingsInput>(DEFAULT_SETTINGS);
  const create = useAction(api.createStory, { success: "Story queued: splitting your script into scenes", invalidate: [["stories"]] });
  const length = script.trim().length;

  const submit = () =>
    create.mutate(
      { projectId, category, settings, render, script: script.trim(), title: title.trim() || undefined },
      {
        onSuccess: ({ story }) => {
          onOpenChange(false);
          setTitle("");
          setScript("");
          window.location.hash = href.story(story.id);
        },
      },
    );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create story"
      description="Write or paste your own story or movie script. It is split into the configured number of scenes, keeping your words as the narration; image prompts are written for you."
      submitLabel="Create story"
      pending={create.isPending}
      disabled={length < MIN_SCRIPT}
      onSubmit={submit}
      className="h-[80vh] w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[90vw]"
    >
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Category"
          value={category}
          options={categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}` }))}
          onChange={(v) => setCategory(v as CategoryId)}
        />
        <TextField label="Title (optional)" value={title} onChange={setTitle} placeholder="Taken from the script if empty" />
      </div>
      <TextField
        label="Script"
        lang={settings.narrationLanguage}
        value={script}
        onChange={setScript}
        multiline
        rows={12}
        placeholder={"Write or paste your story or movie script here.\n\nScenes follow the script's order; each paragraph roughly becomes one or more scenes."}
        hint={`${length} characters${length < MIN_SCRIPT ? ` · at least ${MIN_SCRIPT}` : ""} · split into ${settings.sceneCount ?? 1} scenes (set below)`}
      />
      <SettingsForm value={settings} onChange={setSettings} category={category} />
      <div className="flex items-center gap-2">
        <Switch id="render-custom" checked={render} onCheckedChange={setRender} />
        <Label htmlFor="render-custom">Render images, narration and video after the script</Label>
      </div>
    </FormDialog>
  );
}
