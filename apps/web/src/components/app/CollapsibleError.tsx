import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type ErrorItem, parseErrorItems } from "@/lib/errorUtils";

interface CollapsibleErrorCardProps {
  item: ErrorItem;
  defaultOpen?: boolean;
}

function CollapsibleErrorCard({ item, defaultOpen = false }: CollapsibleErrorCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // First line preview for collapsed state
  const firstLine = item.message.split(/\r?\n/)[0]?.trim() ?? "";

  return (
    <div className="overflow-hidden rounded-lg border border-red-500/40 bg-red-500/10 text-red-600 shadow-2xs transition-colors dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
      {/* Clickable Header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-red-500/15 cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
          <span className="text-sm font-semibold tracking-tight text-red-700 dark:text-red-300">
            {item.title}
          </span>
          {item.step && (
            <Badge
              variant="outline"
              className="h-4 border-red-500/40 bg-red-500/20 px-1.5 text-[10px] font-mono uppercase text-red-700 dark:border-red-500/30 dark:text-red-300"
            >
              {item.step}
            </Badge>
          )}
          {!open && (
            <span className="hidden truncate text-xs text-red-600/80 sm:inline dark:text-red-400/80">
              — {firstLine}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] font-medium text-red-600/80 dark:text-red-400/80">
            {open ? "Collapse" : "Expand"}
          </span>
          <ChevronDown
            className={cn("size-4 text-red-600 transition-transform duration-200 dark:text-red-400", open && "rotate-180")}
          />
        </div>
      </button>

      {/* Expanded Details */}
      {open && (
        <div className="border-t border-red-500/20 bg-background/50 p-3 dark:bg-black/30">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Full error message
            </span>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              title="Copy error message"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="max-h-80 overflow-auto rounded-md border border-red-500/20 bg-muted/60 p-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap select-text text-foreground dark:bg-muted/30">
            {item.message}
          </pre>
        </div>
      )}
    </div>
  );
}

interface CollapsibleErrorProps {
  error?: string | null;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Collapsible Error display component:
 * Extracts titles such as "Scene 18: Error" and allows expanding to the full message.
 */
export function CollapsibleError({ error, className, defaultOpen = false }: CollapsibleErrorProps) {
  if (!error) return null;

  const items = parseErrorItems(error);
  if (!items.length) return null;

  return (
    <div className={cn("grid gap-2", className)}>
      {items.map((item) => (
        <CollapsibleErrorCard key={item.id} item={item} defaultOpen={defaultOpen} />
      ))}
    </div>
  );
}
