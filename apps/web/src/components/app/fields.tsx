import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Field({
  label,
  hint,
  hintPlacement = "below",
  className,
  children,
}: {
  label: string;
  hint?: string;
  /** "top" puts the hint on the label row, right-aligned; "below" keeps it under the control. */
  hintPlacement?: "below" | "top";
  className?: string;
  children: ReactNode;
}) {
  const hintOnTop = !!hint && hintPlacement === "top";
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {hintOnTop && <p className="text-right text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
      {hint && !hintOnTop && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Default",
  className,
  hint,
}: {
  label: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hint?: string;
}) {
  return (
    <Field label={label} className={className} hint={hint}>
      <Select items={options} value={value ?? null} onValueChange={(v) => v !== null && onChange(String(v))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  hintPlacement,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  hintPlacement?: "below" | "top";
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint} hintPlacement={hintPlacement}>
      <Input type="number" value={value ?? ""} min={min} max={max} step={step} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  placeholder,
  lang,
  hint,
  type,
  disabled,
  className,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  lang?: string;
  hint?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      {multiline ? (
        <Textarea lang={lang} rows={rows} value={value ?? ""} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input lang={lang} type={type} value={value ?? ""} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}
