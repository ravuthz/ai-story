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

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
}: {
  label: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
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
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
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
