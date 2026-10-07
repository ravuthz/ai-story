import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction, useCategories } from "@/hooks/queries";
import { api, type CategoryId, type SettingsInput } from "@/lib/api";
import { categoryEmoji } from "./badges";
import { NumberField, SelectField } from "./fields";
import { FormDialog } from "./FormDialog";
import { DEFAULT_SETTINGS, SettingsForm } from "./SettingsForm";

const MAX_COUNT = 1000;

/** Creates one story (count = 1) or queues a batch of unique stories. */
export function NewStoryDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useCategories();
  const [category, setCategory] = useState<CategoryId>("horror-story");
  const [count, setCount] = useState(10);
  const [render, setRender] = useState(true);
  const [settings, setSettings] = useState<SettingsInput>(DEFAULT_SETTINGS);

  const close = () => onOpenChange(false);
  const single = useAction(api.createStory, { success: "Story queued", invalidate: [["stories"]] });
  const batch = useAction(api.batch, { success: `Batch of ${count} queued`, invalidate: [["stories"]] });

  const submit = () => {
    const input = { projectId, category, settings, render };
    if (count === 1) single.mutate(input, { onSuccess: close });
    else batch.mutate({ ...input, count }, { onSuccess: close });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Generate stories"
      description="Every story uses a unique combination of theme, setting, character, twist and tone."
      submitLabel={count === 1 ? "Generate story" : `Queue ${count} stories`}
      pending={single.isPending || batch.isPending}
      onSubmit={submit}
      className="h-[80vh] w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[90vw]"
    >
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Category"
          value={category}
          options={categories.map((c) => ({ value: c.id, label: `${categoryEmoji(c.id)} ${c.label}` }))}
          onChange={(v) => setCategory(v as CategoryId)}
        />
        <NumberField
          label="How many"
          min={1}
          max={MAX_COUNT}
          value={count}
          onChange={(v) => setCount(Math.min(MAX_COUNT, Math.max(1, Math.round(v) || 1)))}
        />
      </div>
      <SettingsForm value={settings} onChange={setSettings} />
      <div className="flex items-center gap-2">
        <Switch id="render" checked={render} onCheckedChange={setRender} />
        <Label htmlFor="render">Render images, narration and video after the script</Label>
      </div>
    </FormDialog>
  );
}
