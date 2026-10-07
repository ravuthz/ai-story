import { AudioLines, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { ProviderDialog } from "@/components/app/ProviderDialog";
import { VoicesDialog } from "@/components/app/VoicesDialog";
import { PageHeader } from "@/components/app/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { keys, useAction, useProviderConfigs } from "@/hooks/queries";
import { api, type ProviderConfig, type ProviderKind, type Voice } from "@/lib/api";

type VoiceMode = Voice["mode"];

const KINDS = [
  { kind: "text", tab: "Script", title: "Story writers", hint: "Headless agent CLIs (codex, claude, gemini, agy, omp), any Gradio app, or MCP" },
  { kind: "image", tab: "Image", title: "Image", hint: "Codex CLI (local), Gemini, any Gradio space / URL / local app (Qwen-Image…), or MCP" },
  { kind: "audio", tab: "Audio", title: "Narration", hint: "Edge TTS (native Khmer voices), Gemini TTS, any Gradio TTS app (VoxCPM…), or MCP" },
  { kind: "video", tab: "Video", title: "Motion video", hint: "FFmpeg Ken Burns locally, any Gradio image-to-video app, or MCP" },
] as const;

const INVALIDATE = [keys.providers, keys.providerConfigs];

/** Provider types whose voices are uploaded reference clips (matches CLONING_TYPES on the server). */
const CLONING_TYPES = new Set(["gradio-audio"]);

function ProviderRow({ p, onEdit, onVoices }: { p: ProviderConfig; onEdit: () => void; onVoices: (add?: VoiceMode) => void }) {
  const toggle = useAction(api.updateProvider, { invalidate: INVALIDATE });
  const setDefault = useAction(api.setDefaultProvider, { success: `${p.label} is now the default`, invalidate: INVALIDATE });
  const remove = useAction(api.deleteProvider, { success: `${p.label} deleted`, invalidate: INVALIDATE });
  const status = !p.enabled ? "disabled" : p.available ? "ready" : "not configured";

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
      <Switch
        checked={p.enabled}
        disabled={p.isDefault || toggle.isPending}
        onCheckedChange={(enabled) => toggle.mutate({ id: p.id, enabled })}
        aria-label={p.enabled ? `Disable ${p.label}` : `Enable ${p.label}`}
      />
      <span className="min-w-0 flex-1">
        <span className="font-mono text-xs text-muted-foreground">{p.slug}</span> · {p.label}
        {p.isDefault && <Badge className="ml-2">default</Badge>}
        <span className="block truncate font-mono text-xs text-muted-foreground">{p.detail ?? p.driverLabel}</span>
      </span>
      <span className={p.enabled && p.available ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{status}</span>
      <div className="flex shrink-0 gap-0.5">
        {CLONING_TYPES.has(p.type) && (
          <Button size="xs" variant="outline" onClick={() => onVoices()} title="Clone or design voices">
            <AudioLines /> Clone / design voices
          </Button>
        )}
        {!p.isDefault && (
          <Button size="icon-xs" variant="ghost" disabled={!p.enabled} onClick={() => setDefault.mutate(p.id)} aria-label="Make default" title="Make default">
            <Star />
          </Button>
        )}
        <Button size="icon-xs" variant="ghost" onClick={onEdit} aria-label="Edit" title="Edit">
          <Pencil />
        </Button>
        {!p.isDefault && (
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => confirm(`Delete provider "${p.label}"? Stories that use "${p.slug}" will fall back to an error.`) && remove.mutate(p.id)}
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProvidersPage() {
  const { data = [] } = useProviderConfigs();
  const [tab, setTab] = useState<ProviderKind>("text");
  const [voicesFor, setVoicesFor] = useState<{ provider: ProviderConfig; add?: VoiceMode } | null>(null);
  const [dialog, setDialog] = useState<{ kind: ProviderKind; provider?: ProviderConfig } | null>(null);

  return (
    <>
      <PageHeader title="Providers" description="Stored in the database and applied immediately; every story can override the defaults in its settings." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as ProviderKind)} className="p-8">
        <TabsList>
          {KINDS.map(({ kind, tab }) => (
            <TabsTrigger key={kind} value={kind}>
              {tab}
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">{data.filter((p) => p.kind === kind && p.enabled).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {KINDS.map(({ kind, title, hint }) => (
          <TabsContent key={kind} value={kind}>
            <Card>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{hint}</CardDescription>
                <CardAction>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ kind })}>
                    <Plus /> Add
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data
                  .filter((p) => p.kind === kind)
                  .map((p) => (
                    <ProviderRow key={p.id} p={p} onEdit={() => setDialog({ kind, provider: p })} onVoices={(add) => setVoicesFor({ provider: p, add })} />
                  ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      {voicesFor && (
        <VoicesDialog
          key={`${voicesFor.provider.id}-${voicesFor.add ?? ""}`}
          provider={voicesFor.provider}
          initialTab={voicesFor.add}
          onOpenChange={(open) => !open && setVoicesFor(null)}
        />
      )}
      {dialog && (
        <ProviderDialog
          key={dialog.provider?.id ?? `new-${dialog.kind}`}
          kind={dialog.kind}
          provider={dialog.provider}
          // From the Edit dialog: close it and open the voices dialog (optionally straight into clone / design).
          onVoices={(add) => {
            const provider = dialog.provider!;
            setDialog(null);
            setVoicesFor({ provider, add });
          }}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
    </>
  );
}
