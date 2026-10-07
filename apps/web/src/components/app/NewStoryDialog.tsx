import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction, useCategories } from "@/hooks/queries";
import { api, type CategoryId, type SettingsInput } from "@/lib/api";
import { categoryEmoji } from "./badges";
import { NumberField, SelectField } from "./fields";
import { FormDialog } from "./FormDialog";
import { DEFAULT_SETTINGS, SettingsForm } from "./SettingsForm";

type Mode = "single" | "batch";

/** Creates one story (script now) or queues a batch of unique stories. */
export function NewStoryDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useCategories();
  const [mode, setMode] = useState<Mode>("single");
  const [category, setCategory] = useState<CategoryId>("horror-story");
  const [count, setCount] = useState(10);
  const [render, setRender] = useState(true);
  const [settings, setSettings] = useState<SettingsInput>(DEFAULT_SETTINGS);

  const close = () => onOpenChange(false);
  const single = useAction(api.createStory, { success: "Story queued", invalidate: [["stories"]] });
  const batch = useAction(api.batch, { success: `Batch of ${count} queued`, invalidate: [["stories"]] });
  const selected = categories.find((c) => c.id === category);

  const submit = () => {
    const input = { projectId, category, settings, render };
    if (mode === "single") single.mutate(input, { onSuccess: close });
    else batch.mutate({ ...input, count }, { onSuccess: close });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Generate stories"
      description="Every story uses a unique combination of theme, setting, character, twist and tone."
      submitLabel={mode === "single" ? "Generate story" : `Queue ${count} stories`}
      pending={single.isPending || batch.isPending}
      onSubmit={submit}
      className="sm:max-w-3xl"
    >
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="batch">Batch</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Category"
          value={category}
          options={categories.map((c) => ({ value: c.id, label: `${categoryEmoji(c.id)} ${c.label}` }))}
          onChange={(v) => setCategory(v as CategoryId)}
        />
        {mode === "batch" && (
          <NumberField
            label="How many"
            min={1}
            max={5000}
            value={count}
            onChange={setCount}
            hint={selected ? `${(selected.capacity - selected.count).toLocaleString()} unique combinations left` : undefined}
          />
        )}
      </div>
      <SettingsForm value={settings} onChange={setSettings} />
      <div className="flex items-center gap-2">
        <Switch id="render" checked={render} onCheckedChange={setRender} />
        <Label htmlFor="render">Render images, narration and video after the script</Label>
      </div>
    </FormDialog>
  );
}
