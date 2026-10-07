import { AudioLines, Check, Pencil, Play, Sparkles, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { keys, useAction, useProviderConfigs, useProviderVoices } from "@/hooks/queries";
import { api, fileUrl, type DefaultVoice, type ProviderConfig, type Voice } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Field, TextField } from "./fields";

type Mode = Voice["mode"];
const INVALIDATE = [keys.voices, keys.providerConfigs];
const SAMPLE_TEXT = "សួស្តី! ថ្ងៃនេះ ខ្ញុំនឹងនិទានរឿងមួយជូនអ្នកស្តាប់។";

/** Upload a new cloned voice, or edit one (the clip is optional when editing: it replaces the old one). */
function CloneForm({ voice, pending, onSubmit, onCancel }: {
  voice?: Voice;
  pending: boolean;
  onSubmit: (input: { name: string; mode: Mode; transcript: string; style: string; file?: File }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(voice?.name ?? "");
  const [transcript, setTranscript] = useState(voice?.transcript ?? "");
  const [style, setStyle] = useState(voice?.style ?? "");
  const [file, setFile] = useState<File | undefined>();
  const ready = !!name.trim() && (!!file || !!voice?.filePath);

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ name, mode: "clone", transcript, style, file });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name *" value={name} onChange={setName} placeholder="Grandma storyteller" />
        <Field label={voice ? "Replace reference audio" : "Reference audio *"} hint="5–30s of clean speech · wav, mp3, flac, ogg, m4a">
          <Input type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.webm,.aac" onChange={(e) => setFile(e.target.files?.[0])} />
        </Field>
      </div>
      <TextField label="Transcript" multiline rows={2} value={transcript} onChange={setTranscript} hint="Exactly what is said in the clip; improves cloning (optional)" />
      <TextField label="Style" value={style} onChange={setStyle} placeholder="warm, slow, gentle" hint="Optional control instruction sent with the clip" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!ready || pending}>
          {pending ? "Uploading…" : voice ? "Save voice" : "Upload voice"}
        </Button>
      </div>
    </form>
  );
}

/** A selectable cloned voice: click to select it for generation; play, edit or delete it. */
function CloneRow({ voice, selected, inUse, onSelect }: { voice: Voice; selected: boolean; inUse: boolean; onSelect: () => void }) {
  const [editing, setEditing] = useState(false);
  const update = useAction(api.updateVoice, { success: "Voice saved", invalidate: INVALIDATE });
  const remove = useAction(api.deleteVoice, { success: `${voice.name} deleted`, invalidate: INVALIDATE });

  if (editing) {
    return (
      <CloneForm
        voice={voice}
        pending={update.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={(input) => update.mutate({ id: voice.id, ...input }, { onSuccess: () => setEditing(false) })}
      />
    );
  }
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
      className={cn(
        "grid cursor-pointer gap-2 rounded-lg border p-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", selected && "border-primary bg-primary text-primary-foreground")}>
          {selected && <Check className="size-3" />}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{voice.name}</span>
        {inUse && <Badge>in use</Badge>}
        <Button size="icon-xs" variant="ghost" onClick={(e) => (e.stopPropagation(), setEditing(true))} aria-label={`Edit ${voice.name}`}>
          <Pencil />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete voice "${voice.name}"?${inUse ? " It is the voice in use; narration falls back to the app's default voice." : ""}`)) remove.mutate(voice.id);
          }}
          aria-label={`Delete ${voice.name}`}
        >
          <Trash2 />
        </Button>
      </div>
      {voice.filePath && <audio controls preload="none" src={fileUrl(voice.filePath, voice.updatedAt)} className="h-8 w-full" onClick={(e) => e.stopPropagation()} />}
      {voice.transcript && <p className="text-xs text-muted-foreground">“{voice.transcript}”</p>}
      {voice.style && <p className="text-xs text-muted-foreground">Style: {voice.style}</p>}
    </div>
  );
}

/** Speak a line with the current (unsaved) choice, to hear it before using it. */
function TryIt({ providerId, choice, ready }: { providerId: string; choice: DefaultVoice; ready: boolean }) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [clip, setClip] = useState<string>();
  const preview = useAction(api.previewVoice, {});
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-end gap-2">
        <TextField label="Try it: generate speech from text" value={text} onChange={setText} className="flex-1" />
        <Button
          type="button"
          variant="outline"
          disabled={!ready || !text.trim() || preview.isPending}
          onClick={() => preview.mutate({ providerId, ...choice, text }, { onSuccess: (r) => setClip(fileUrl(r.filePath, String(Date.now()))) })}
        >
          <Play /> {preview.isPending ? "Generating…" : "Generate"}
        </Button>
      </div>
      {clip && <audio key={clip} controls autoPlay src={clip} className="h-8 w-full" />}
    </div>
  );
}

/**
 * How a provider narrates by default: "Use clone voice" (pick one of its uploaded clones) or
 * "Design a voice" (a required description). Stories can still override it in their settings.
 */
export function VoicesDialog({ provider: initial, initialTab, onOpenChange }: { provider: ProviderConfig; initialTab?: Mode; onOpenChange: (open: boolean) => void }) {
  const { data: providers } = useProviderConfigs();
  const provider = providers?.find((p) => p.id === initial.id) ?? initial;
  const saved = (provider.config.defaultVoice ?? {}) as Partial<DefaultVoice>;
  const { data: voices = [], isLoading } = useProviderVoices(provider.id);
  const clones = voices.filter((v) => v.mode === "clone");

  const [tab, setTab] = useState<Mode>(initialTab ?? saved.mode ?? "clone");
  const [selectedId, setSelectedId] = useState(saved.mode === "clone" ? saved.voiceId : undefined);
  const [description, setDescription] = useState(saved.mode === "design" ? (saved.description ?? "") : "");
  const [uploading, setUploading] = useState(false);

  const create = useAction(api.createVoice, { success: "Voice uploaded", invalidate: INVALIDATE });
  const save = useAction(api.setDefaultVoice, { success: `${provider.label} voice saved`, invalidate: INVALIDATE });

  const selected = clones.find((v) => v.id === selectedId);
  const choice: DefaultVoice = tab === "clone" ? { mode: "clone", voiceId: selected?.id } : { mode: "design", description: description.trim() };
  const ready = tab === "clone" ? !!selected : !!description.trim();
  const inUse = saved.mode === tab && (tab === "clone" ? saved.voiceId === selected?.id : saved.description === description.trim());

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{provider.label} voices</DialogTitle>
          <DialogDescription>Choose how {provider.label} narrates: one of your cloned voices, or a voice designed from a description. Stories can override it in their settings.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)} className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="clone">
              <AudioLines /> Use clone voice
            </TabsTrigger>
            <TabsTrigger value="design">
              <Sparkles /> Design a voice
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clone" className="grid gap-2">
            <p className="text-sm text-muted-foreground">Select the voice to generate speech with, or upload a new one.</p>
            <div role="radiogroup" aria-label="Cloned voices" className="grid gap-2">
              {clones.map((v) => (
                <CloneRow key={v.id} voice={v} selected={v.id === selectedId} inUse={saved.mode === "clone" && saved.voiceId === v.id} onSelect={() => setSelectedId(v.id)} />
              ))}
            </div>
            {!isLoading && !clones.length && !uploading && <p className="text-sm text-muted-foreground">No cloned voices yet. Upload a 5–30s clip to clone one.</p>}
            {uploading ? (
              <CloneForm
                pending={create.isPending}
                onCancel={() => setUploading(false)}
                onSubmit={(input) =>
                  create.mutate(
                    { providerId: provider.id, ...input },
                    {
                      onSuccess: (voice) => {
                        setUploading(false);
                        setSelectedId(voice.id);
                      },
                    },
                  )
                }
              />
            ) : (
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setUploading(true)}>
                <Upload /> Upload a voice
              </Button>
            )}
          </TabsContent>

          <TabsContent value="design" className="grid gap-2">
            <TextField
              label="Voice description *"
              multiline
              rows={4}
              value={description}
              onChange={setDescription}
              placeholder="An elderly man with a deep, calm, slightly raspy voice, speaking slowly like a storyteller"
              hint="Required. Describe gender, age, pitch, timbre, pace and emotion; no audio needed."
            />
          </TabsContent>
        </Tabs>

        {/* Keyed by tab so a sample from one kind of voice never shows under the other. */}
        <TryIt key={tab} providerId={provider.id} choice={choice} ready={ready} />

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {inUse ? "This is the voice in use." : tab === "clone" ? (selected ? `Use “${selected.name}” for narration.` : "Select a cloned voice.") : description.trim() ? "Use this designed voice for narration." : "Enter a voice description."}
          </span>
          <Button disabled={!ready || inUse || save.isPending} onClick={() => save.mutate({ providerId: provider.id, ...choice })}>
            <Check /> {inUse ? "In use" : "Use this voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
