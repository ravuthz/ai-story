import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { keys, useAction, useProviderVoices } from "@/hooks/queries";
import { api, fileUrl, type ProviderConfig, type Voice } from "@/lib/api";
import { Field, TextField } from "./fields";

const INVALIDATE = [keys.voices];

/** Add or edit one voice; the reference clip is required when adding and optional (replace) when editing. */
function VoiceForm({
  voice,
  pending,
  onSubmit,
  onCancel,
}: {
  voice?: Voice;
  pending: boolean;
  onSubmit: (input: { name: string; transcript: string; style: string; file?: File }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(voice?.name ?? "");
  const [transcript, setTranscript] = useState(voice?.transcript ?? "");
  const [style, setStyle] = useState(voice?.style ?? "");
  const [file, setFile] = useState<File | undefined>();
  const ready = !!name.trim() && (voice || file);

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ name, transcript, style, file });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} placeholder="Grandma storyteller" />
        <Field label={voice ? "Replace reference audio" : "Reference audio *"} hint="5–30s of clean speech · wav, mp3, flac, ogg, m4a">
          <Input type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.webm,.aac" onChange={(e) => setFile(e.target.files?.[0])} />
        </Field>
      </div>
      <TextField
        label="Transcript"
        multiline
        rows={2}
        value={transcript}
        onChange={setTranscript}
        hint="Exactly what is said in the clip; improves cloning (optional)"
      />
      <TextField label="Style" value={style} onChange={setStyle} placeholder="warm, slow, gentle" hint="Optional control instruction sent with the voice" />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!ready || pending}>
          {pending ? "Uploading…" : voice ? "Save voice" : "Add voice"}
        </Button>
      </div>
    </form>
  );
}

function VoiceRow({ voice }: { voice: Voice }) {
  const [editing, setEditing] = useState(false);
  const update = useAction(api.updateVoice, { success: "Voice saved", invalidate: INVALIDATE });
  const remove = useAction(api.deleteVoice, { success: `${voice.name} deleted`, invalidate: INVALIDATE });

  if (editing) {
    return (
      <VoiceForm
        voice={voice}
        pending={update.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={(input) => update.mutate({ id: voice.id, ...input }, { onSuccess: () => setEditing(false) })}
      />
    );
  }
  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{voice.name}</span>
        <Button size="icon-xs" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${voice.name}`}>
          <Pencil />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => confirm(`Delete voice "${voice.name}"? Stories using it will narrate with the default voice.`) && remove.mutate(voice.id)}
          aria-label={`Delete ${voice.name}`}
        >
          <Trash2 />
        </Button>
      </div>
      <audio controls preload="none" src={fileUrl(voice.filePath, voice.updatedAt)} className="h-8 w-full" />
      {voice.transcript && <p className="text-xs text-muted-foreground">“{voice.transcript}”</p>}
      {voice.style && <p className="text-xs text-muted-foreground">Style: {voice.style}</p>}
    </div>
  );
}

/** Upload, preview, edit and delete the cloned voices of one audio provider. */
export function VoicesDialog({ provider, onOpenChange }: { provider: ProviderConfig; onOpenChange: (open: boolean) => void }) {
  const { data: voices = [], isLoading } = useProviderVoices(provider.id);
  const [adding, setAdding] = useState(false);
  const create = useAction(api.createVoice, { success: "Voice added", invalidate: INVALIDATE });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{provider.label} voices</DialogTitle>
          <DialogDescription>Upload a short reference clip to clone a voice, then pick it as the Voice in a story's settings.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {voices.map((v) => (
            <VoiceRow key={v.id} voice={v} />
          ))}
          {!isLoading && !voices.length && !adding && <p className="text-sm text-muted-foreground">No voices yet.</p>}
        </div>
        {adding ? (
          <VoiceForm
            pending={create.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(input) => create.mutate({ providerId: provider.id, ...input }, { onSuccess: () => setAdding(false) })}
          />
        ) : (
          <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setAdding(true)}>
            <Plus /> Add voice
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
