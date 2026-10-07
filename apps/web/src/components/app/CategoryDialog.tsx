import { ClipboardCopy, ClipboardPaste, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { keys, useAction, useTemplateDefaults } from "@/hooks/queries";
import { api, type CategoryInfo, type CategoryPools } from "@/lib/api";
import { CATEGORY_JSON_FORMAT, parseCategoryJson, type CategoryJson } from "@/lib/categoryJson";
import { Field, TextField } from "./fields";
import { FormDialog } from "./FormDialog";

const POOLS: { key: keyof CategoryPools; label: string; hint: string }[] = [
  { key: "themes", label: "Themes", hint: "What the story is about" },
  { key: "settings", label: "Settings", hint: "Where it happens" },
  { key: "protagonists", label: "Main characters", hint: "Who it follows" },
  { key: "twists", label: "Twists / endings", hint: "How it turns" },
  { key: "tones", label: "Tones", hint: "How it feels" },
];

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const placeholdersIn = (t: string) => new Set([...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));

/** Chips for the category's suggested image styles: Enter or comma adds, × removes. */
function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.split(",").map((t) => t.trim()).filter((t) => t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()));
    if (next.length) onChange([...tags, ...next]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <div className="grid gap-2">
      <div className="flex min-h-9 flex-wrap gap-1.5 rounded-md border p-2">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            {t}
            <button type="button" className="rounded-sm hover:bg-foreground/10" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {!tags.length && <span className="text-xs text-muted-foreground">No suggestions yet</span>}
      </div>
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder="Type a style and press Enter, e.g. moody fog" />
    </div>
  );
}

/** A template textarea with clickable placeholders that insert at the cursor, and a reset to the default. */
function TemplateEditor({
  label,
  value,
  onChange,
  placeholders,
  required,
  defaultValue,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholders: Record<string, string>;
  required: string[];
  defaultValue?: string;
  rows: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const used = placeholdersIn(value);
  const missing = required.filter((p) => !used.has(p));
  const insert = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) return onChange(value + token);
    const { selectionStart: a, selectionEnd: b } = el;
    onChange(value.slice(0, a) + token + value.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1">
        {Object.entries(placeholders).map(([name, help]) => (
          <Button
            key={name}
            type="button"
            size="xs"
            variant={required.includes(name) && !used.has(name) ? "destructive" : used.has(name) ? "secondary" : "outline"}
            title={help}
            onClick={() => insert(name)}
            className="font-mono"
          >
            {`{{${name}}}`}
          </Button>
        ))}
      </div>
      <Textarea ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs ${missing.length ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
          {missing.length ? `Missing required: ${missing.map((p) => `{{${p}}}`).join(", ")}` : "Click a placeholder to insert it at the cursor."}
        </p>
        {defaultValue && value !== defaultValue && (
          <Button type="button" size="xs" variant="ghost" onClick={() => onChange(defaultValue)}>
            <RotateCcw /> Reset to default
          </Button>
        )}
      </div>
    </Field>
  );
}

/** Create, duplicate or edit a category: general info, seed pools, style suggestions and prompt templates. */
export function CategoryDialog({
  category,
  duplicateOf,
  onOpenChange,
}: {
  /** Editing an existing category (id is fixed). */
  category?: CategoryInfo;
  /** Prefill a new category from this one. */
  duplicateOf?: CategoryInfo;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: defaults } = useTemplateDefaults();
  const base = category ?? duplicateOf;
  const [id, setId] = useState(duplicateOf ? `${duplicateOf.id}-copy` : (category?.id ?? ""));
  const [label, setLabel] = useState(duplicateOf ? `${duplicateOf.label} (copy)` : (base?.label ?? ""));
  const [emoji, setEmoji] = useState(base?.emoji ?? "📖");
  const [description, setDescription] = useState(base?.description ?? "");
  const [imageStyle, setImageStyle] = useState(base?.imageStyle ?? "");
  const [pools, setPools] = useState<Record<keyof CategoryPools, string>>(
    () => Object.fromEntries(POOLS.map(({ key }) => [key, (base?.pools[key] ?? []).join("\n")])) as Record<keyof CategoryPools, string>,
  );
  const [styles, setStyles] = useState<string[]>(base?.styleSuggestions ?? []);
  const [storyPrompt, setStoryPrompt] = useState(base?.storyPrompt ?? "");
  const [imagePrompt, setImagePrompt] = useState(base?.imagePrompt ?? "");
  const [tab, setTab] = useState("general");

  // New categories start from the default templates once they have loaded.
  const story = storyPrompt || (!base ? (defaults?.storyPrompt ?? "") : "");
  const image = imagePrompt || (!base ? (defaults?.imagePrompt ?? "") : "");

  const parsedPools = Object.fromEntries(POOLS.map(({ key }) => [key, lines(pools[key])])) as unknown as CategoryPools;
  const capacity = POOLS.reduce((n, { key }) => n * parsedPools[key].length, 1);
  const emptyPools = POOLS.filter(({ key }) => !parsedPools[key].length);

  const invalidate = [keys.categories];
  const create = useAction(api.createCategory, { success: "Category created", invalidate });
  const update = useAction(api.updateCategory, { success: "Category saved", invalidate });
  // Same rules the server enforces: every seed in the story prompt, {{scenePrompt}} in the image prompt.
  const storyUsed = placeholdersIn(story);
  const templatesOk = (defaults?.requiredSeeds ?? []).every((p) => storyUsed.has(p)) && placeholdersIn(image).has("scenePrompt");
  const ready =
    !!label.trim() && (category || /^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) && !emptyPools.length && !!story.trim() && !!image.trim() && templatesOk;

  // --- Copy / paste the whole form as JSON (same shape both ways) ---
  const [pasteBox, setPasteBox] = useState(false);
  const formJson = (): CategoryJson => ({
    format: CATEGORY_JSON_FORMAT,
    id: category?.id ?? id,
    label,
    emoji,
    description,
    imageStyle,
    pools: parsedPools,
    styleSuggestions: styles,
    storyPrompt: story,
    imagePrompt: image,
  });
  const copyJson = async () => {
    const text = JSON.stringify(formJson(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Category JSON copied", { description: ready ? undefined : "Note: the form is not complete yet" });
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };
  const applyJson = (text: string) => {
    const parsed = parseCategoryJson(text, defaults?.requiredSeeds ?? ["theme", "setting", "protagonist", "twist", "tone"]);
    if (!parsed.ok) {
      toast.error("Not a valid category JSON", { description: parsed.errors.slice(0, 6).join(" · ") + (parsed.errors.length > 6 ? ` · +${parsed.errors.length - 6} more` : "") });
      return false;
    }
    const v = parsed.value;
    // The id of an existing category is fixed; a new one takes the pasted id.
    if (!category && v.id) setId(v.id);
    setLabel(v.label);
    setEmoji(v.emoji);
    setDescription(v.description);
    setImageStyle(v.imageStyle);
    setPools(Object.fromEntries(POOLS.map(({ key }) => [key, v.pools[key].join("\n")])) as Record<keyof CategoryPools, string>);
    setStyles(v.styleSuggestions);
    setStoryPrompt(v.storyPrompt);
    setImagePrompt(v.imagePrompt);
    toast.success("Pasted into the form", {
      description: category && v.id && v.id !== category.id ? `Kept id "${category.id}" (ids can't change). Review, then save.` : "Review, then save.",
    });
    setPasteBox(false);
    return true;
  };
  const pasteJson = async () => {
    try {
      applyJson(await navigator.clipboard.readText());
    } catch {
      // Clipboard reading can be blocked by the browser; let the user paste with Ctrl/Cmd+V instead.
      setPasteBox(true);
    }
  };

  const submit = () => {
    const body = { label, emoji, description, imageStyle, pools: parsedPools, styleSuggestions: styles, storyPrompt: story, imagePrompt: image };
    if (category) update.mutate({ id: category.id, ...body }, { onSuccess: () => onOpenChange(false) });
    else create.mutate({ id, ...body }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={category ? `Edit ${category.emoji} ${category.label}` : duplicateOf ? `Duplicate ${duplicateOf.label}` : "New category"}
      description="Seeds make every story unique; style suggestions appear as chips in story settings; templates shape the prompts sent to the AI."
      submitLabel={category ? "Save category" : "Create category"}
      pending={create.isPending || update.isPending}
      disabled={!ready}
      onSubmit={submit}
      className="max-h-[90vh] w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-4xl"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyJson}>
          <ClipboardCopy /> Copy JSON
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={pasteJson}>
          <ClipboardPaste /> Paste JSON
        </Button>
        <span className="text-xs text-muted-foreground">Copy this category as JSON, or fill the form from a copied category.</span>
      </div>
      {pasteBox && (
        <Field label="Paste category JSON here" hint="The browser blocked reading the clipboard; press Ctrl/Cmd+V in this box.">
          <Textarea
            autoFocus
            rows={3}
            className="font-mono text-xs"
            placeholder={`{ "format": "${CATEGORY_JSON_FORMAT}", "label": "…", "pools": { … }, … }`}
            onPaste={(e) => {
              e.preventDefault();
              applyJson(e.clipboardData.getData("text"));
            }}
          />
        </Field>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="seeds">
            Seeds {emptyPools.length > 0 && <span className="ml-1 size-1.5 rounded-full bg-red-500" aria-label="incomplete" />}
          </TabsTrigger>
          <TabsTrigger value="styles">Style suggestions</TabsTrigger>
          <TabsTrigger value="prompts">
            Prompt templates {defaults && !templatesOk && <span className="ml-1 size-1.5 rounded-full bg-red-500" aria-label="incomplete" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px]">
            <TextField
              label="Id *"
              value={id}
              onChange={(v) => setId(v.toLowerCase())}
              disabled={!!category}
              placeholder="sci-fi"
              hint={category ? "Stories refer to this id; it can't change" : "lowercase letters, digits and -"}
            />
            <TextField label="Label *" value={label} onChange={setLabel} placeholder="Sci-Fi" />
            <TextField label="Emoji" value={emoji} onChange={setEmoji} />
          </div>
          <TextField label="Description" value={description} onChange={setDescription} multiline rows={2} hint="Shown to the AI as {{categoryDescription}}" />
          <TextField label="Category image style" value={imageStyle} onChange={setImageStyle} hint="Added to every image prompt as {{categoryStyle}}" />
        </TabsContent>

        <TabsContent value="seeds" className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            One per line. Every story picks one of each, and a combination is never reused:{" "}
            <span className="font-medium text-foreground">{capacity.toLocaleString()} unique stories</span>
            {category && category.count > 0 && ` (${category.count} used)`}.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {POOLS.map(({ key, label: poolLabel, hint }) => (
              <TextField
                key={key}
                label={`${poolLabel} (${parsedPools[key].length})`}
                multiline
                rows={6}
                value={pools[key]}
                onChange={(v) => setPools((p) => ({ ...p, [key]: v }))}
                hint={parsedPools[key].length ? hint : `Add at least one · ${hint}`}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="styles" className="grid gap-2">
          <p className="text-sm text-muted-foreground">Image-style chips offered in a story's settings for this category.</p>
          <TagEditor tags={styles} onChange={setStyles} />
        </TabsContent>

        <TabsContent value="prompts" className="grid gap-5">
          {defaults && (
            <>
              <TemplateEditor
                label="Story prompt"
                rows={18}
                value={story}
                onChange={setStoryPrompt}
                placeholders={defaults.storyPlaceholders}
                required={defaults.requiredSeeds}
                defaultValue={defaults.storyPrompt}
              />
              <Field label="Always appended (keeps the script parseable)">
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{defaults.outputContract}</pre>
              </Field>
              <TemplateEditor
                label="Image prompt"
                rows={3}
                value={image}
                onChange={setImagePrompt}
                placeholders={defaults.imagePlaceholders}
                required={["scenePrompt"]}
                defaultValue={defaults.imagePrompt}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </FormDialog>
  );
}
