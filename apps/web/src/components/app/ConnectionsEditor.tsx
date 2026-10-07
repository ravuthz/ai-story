import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TextField } from "./fields";

/** One Gradio connection as edited in the form: JSON parts stay text until the server parses them. */
export interface ConnectionDraft {
  space: string;
  apiName: string;
  enabled: boolean;
  params: string;
  valueMaps: string;
  meta: string;
}

const EMPTY: ConnectionDraft = { space: "", apiName: "/predict", enabled: true, params: "", valueMaps: "", meta: "" };
const MONO = "[&_textarea]:font-mono [&_textarea]:text-xs";

/** Ordered Gradio connections: the first enabled one is tried first, then the next on failure. */
export function ConnectionsEditor({ value, onChange, paramsPlaceholder }: { value: ConnectionDraft[]; onChange: (next: ConnectionDraft[]) => void; paramsPlaceholder?: string }) {
  const patch = (i: number, p: Partial<ConnectionDraft>) => onChange(value.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      {value.map((c, i) => (
        <div key={i} className={`grid gap-3 rounded-lg border p-3 ${c.enabled ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.space || "New connection"}</span>
            <Switch size="sm" checked={c.enabled} onCheckedChange={(enabled) => patch(i, { enabled })} aria-label={c.enabled ? "Disable connection" : "Enable connection"} />
            <Button type="button" size="icon-xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              <ArrowUp />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              <ArrowDown />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove connection">
              <Trash2 />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <TextField label="Gradio space / URL" value={c.space} onChange={(space) => patch(i, { space })} placeholder="owner/space  ·  https://…  ·  http://127.0.0.1:7860" />
            <TextField label="API name" value={c.apiName} onChange={(apiName) => patch(i, { apiName })} placeholder="/generate" />
          </div>
          <TextField label="Parameters" multiline rows={6} className={MONO} value={c.params} onChange={(params) => patch(i, { params })} placeholder={paramsPlaceholder} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Value maps"
              multiline
              rows={3}
              className={MONO}
              value={c.valueMaps}
              onChange={(valueMaps) => patch(i, { valueMaps })}
              placeholder={'{ "aspectRatio": { "9:16": "Portrait · 9:16" } }'}
            />
            <TextField label="Extra settings (not sent)" multiline rows={3} className={MONO} value={c.meta} onChange={(meta) => patch(i, { meta })} />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...value, { ...EMPTY }])}>
        <Plus /> Add connection
      </Button>
    </div>
  );
}
