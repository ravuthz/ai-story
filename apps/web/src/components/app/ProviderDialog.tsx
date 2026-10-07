import { useState } from "react";
import { AudioLines, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keys, useAction, useProviderDrivers, useProviderVoices } from "@/hooks/queries";
import { api, type DriverField, type ProviderConfig, type ProviderKind } from "@/lib/api";
import { ConnectionsEditor, type ConnectionDraft } from "./ConnectionsEditor";
import { Field, SelectField, TextField } from "./fields";
import { FormDialog } from "./FormDialog";

const INVALIDATE = [keys.providers, keys.providerConfigs];

/** Config values are edited as text: lists as "a:b", JSON objects pretty-printed. */
const toText = (field: DriverField, value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (field.type === "list") return Array.isArray(value) ? value.join(":") : String(value);
  if (field.type === "json") return Object.keys(value as object).length ? JSON.stringify(value, null, 2) : "";
  return String(value);
};

const json = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && Object.keys(v).length ? JSON.stringify(v, null, 2) : "");

/** Stored Gradio connections → editable drafts (JSON parts as text). */
const toDrafts = (value: unknown): ConnectionDraft[] =>
  (Array.isArray(value) ? value : []).map((c: Record<string, unknown>) => ({
    space: String(c.space ?? ""),
    apiName: String(c.apiName ?? ""),
    enabled: c.enabled !== false,
    params: json(c.params),
    valueMaps: json(c.valueMaps),
    meta: json(c.meta),
  }));

/** The voice in use, inside the Edit dialog, with shortcuts to the two voice tabs. */
function VoicesSection({ provider, onVoices }: { provider: ProviderConfig; onVoices: (tab?: "clone" | "design") => void }) {
  const { data: voices = [] } = useProviderVoices(provider.id);
  const saved = (provider.config.defaultVoice ?? {}) as { mode?: string; voiceId?: string; description?: string };
  const inUse =
    saved.mode === "clone"
      ? `Cloned voice “${voices.find((v) => v.id === saved.voiceId)?.name ?? "…"}”`
      : saved.mode === "design"
        ? `Designed voice: ${saved.description}`
        : "The app's own default voice";
  return (
    <Field label="Voice" hint="Stories use this unless they choose their own voice.">
      <div className="grid gap-2 rounded-lg border p-3">
        <p className="truncate text-sm">
          <span className="text-muted-foreground">In use: </span>
          {inUse}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => onVoices("clone")}>
            <AudioLines /> Use clone voice
          </Button>
          <Button type="button" variant="outline" onClick={() => onVoices("design")}>
            <Sparkles /> Design a voice
          </Button>
        </div>
      </div>
    </Field>
  );
}

/** Adds a provider (pick a driver type) or edits an existing one; type and id are fixed after creation. */
export function ProviderDialog({
  kind,
  provider,
  open,
  onOpenChange,
  onVoices,
}: {
  kind: ProviderKind;
  provider?: ProviderConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the voices dialog for this provider; `add` jumps straight into cloning or designing. */
  onVoices?: (add?: "clone" | "design") => void;
}) {
  const { data: drivers = [] } = useProviderDrivers();
  const options = drivers.filter((d) => d.kind === kind);
  const [type, setType] = useState(provider?.type);
  const driver = drivers.find((d) => d.type === (type ?? options[0]?.type));
  const [slug, setSlug] = useState(provider?.slug ?? "");
  const [label, setLabel] = useState(provider?.label ?? "");
  const [config, setConfig] = useState<Record<string, string>>({});
  const value = (field: DriverField) => config[field.key] ?? toText(field, provider?.config[field.key]);
  const [connections, setConnections] = useState<ConnectionDraft[] | undefined>();
  const connectionsValue = connections ?? toDrafts(provider?.config.connections);

  const close = () => onOpenChange(false);
  const create = useAction(api.createProvider, { success: "Provider added", invalidate: INVALIDATE });
  const update = useAction(api.updateProvider, { success: "Provider saved", invalidate: INVALIDATE });

  const submit = () => {
    if (!driver) return;
    // Hidden fields (e.g. the default voice) are managed elsewhere; omitting them keeps the stored value.
    const values = Object.fromEntries(driver.fields.filter((f) => !f.hidden).map((f) => [f.key, f.type === "connections" ? connectionsValue : value(f)]));
    if (provider) update.mutate({ id: provider.id, label, config: values }, { onSuccess: close });
    else create.mutate({ type: driver.type, slug: slug.trim(), label, config: values }, { onSuccess: close });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={provider ? `Edit ${provider.label}` : `Add ${kind} provider`}
      description={driver?.description}
      submitLabel={provider ? "Save" : "Add provider"}
      pending={create.isPending || update.isPending}
      disabled={!driver || (!provider && !slug.trim())}
      onSubmit={submit}
      className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
    >
      <div className="grid grid-cols-2 gap-3">
        {provider ? (
          <TextField label="Type" value={provider.driverLabel} onChange={() => {}} disabled />
        ) : (
          <SelectField label="Type" value={driver?.type} options={options.map((d) => ({ value: d.type, label: d.label }))} onChange={(v) => setType(v)} />
        )}
        <TextField
          label="Id"
          value={slug}
          onChange={(v) => setSlug(v.toLowerCase())}
          placeholder="e.g. qwen-fast"
          hint={provider ? "Stories refer to this id; it can't change" : "Stories refer to this id"}
          disabled={!!provider}
        />
      </div>
      <TextField label="Label" value={label} onChange={setLabel} placeholder={driver?.label} />
      {provider && provider.type === "gradio-audio" && onVoices && <VoicesSection provider={provider} onVoices={onVoices} />}
      {driver?.fields.filter((f) => !f.hidden).map((field) =>
        field.type === "connections" ? (
          <Field key={field.key} label={field.label} hint={field.hint}>
            <ConnectionsEditor
              value={connectionsValue}
              onChange={setConnections}
              paramsPlaceholder={driver.kind === "audio" ? '{ "text_input": "{{text}}" }' : '{ "prompt": "{{prompt}}" }'}
            />
          </Field>
        ) : (
        <TextField
          key={field.key}
          label={field.required ? `${field.label} *` : field.label}
          type={field.type === "secret" ? "password" : undefined}
          multiline={field.type === "json"}
          rows={field.key === "params" ? 8 : 3}
          className={field.type === "json" ? "[&_textarea]:font-mono [&_textarea]:text-xs" : undefined}
          value={value(field)}
          onChange={(v) => setConfig((c) => ({ ...c, [field.key]: v }))}
          placeholder={field.placeholder}
          hint={field.type === "secret" && provider?.config[field.key] ? "Leave as is to keep the saved value" : field.hint}
        />
        ),
      )}
      {driver && !driver.fields.length && <p className="text-sm text-muted-foreground">This provider has no settings.</p>}
    </FormDialog>
  );
}
