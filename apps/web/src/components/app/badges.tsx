import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  queued: "bg-muted text-muted-foreground",
  generating: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  rendering: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  scripted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn("capitalize", STATUS_STYLES[status])}>{status}</Badge>;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "horror-story": "👻",
  "love-story": "💞",
  motivation: "🔥",
  philosophy: "🪷",
  quotes: "💬",
  folklore: "🐉",
  "kid-story": "🧸",
};

export const categoryEmoji = (id: string) => CATEGORY_EMOJI[id] ?? "📖";

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className="gap-1">
      <span>{categoryEmoji(category)}</span>
      {category}
    </Badge>
  );
}
