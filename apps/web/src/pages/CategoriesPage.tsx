import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CategoryDialog } from "@/components/app/CategoryDialog";
import { PageHeader } from "@/components/app/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { keys, useAction, useCategories } from "@/hooks/queries";
import { api, type CategoryInfo } from "@/lib/api";

type DialogState = { edit?: CategoryInfo; duplicate?: CategoryInfo } | null;

/** Database-backed categories: seeds, style suggestions and prompt templates. */
export function CategoriesPage() {
  const { data: categories = [] } = useCategories();
  const [dialog, setDialog] = useState<DialogState>(null);
  const remove = useAction(api.deleteCategory, { success: "Category deleted", invalidate: [keys.categories] });

  return (
    <>
      <PageHeader
        title="Categories"
        description="Seeds, style suggestions and prompt templates for each category; stored in the database and applied immediately."
        actions={
          <Button onClick={() => setDialog({})}>
            <Plus /> New category
          </Button>
        }
      />
      <div className="grid gap-4 p-8 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">{c.emoji}</span> {c.label}
              </CardTitle>
              <CardDescription className="line-clamp-2">{c.description || "No description"}</CardDescription>
              <CardAction className="flex gap-0.5">
                <Button size="icon-xs" variant="ghost" onClick={() => setDialog({ edit: c })} aria-label={`Edit ${c.label}`} title="Edit">
                  <Pencil />
                </Button>
                <Button size="icon-xs" variant="ghost" onClick={() => setDialog({ duplicate: c })} aria-label={`Duplicate ${c.label}`} title="Duplicate">
                  <Copy />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={c.count > 0}
                  title={c.count > 0 ? `Has ${c.count} stories; delete them first` : "Delete"}
                  aria-label={`Delete ${c.label}`}
                  onClick={() => confirm(`Delete category "${c.label}"?`) && remove.mutate(c.id)}
                >
                  <Trash2 />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{c.capacity.toLocaleString()} unique</Badge>
                <Badge variant="secondary">{c.count} {c.count === 1 ? "story" : "stories"}</Badge>
                {c.builtIn ? <Badge variant="outline">built-in</Badge> : <Badge variant="outline">custom</Badge>}
              </div>
              <div className="flex flex-wrap gap-1">
                {c.styleSuggestions.slice(0, 6).map((s) => (
                  <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {s}
                  </span>
                ))}
                {c.styleSuggestions.length > 6 && <span className="px-1 text-xs text-muted-foreground">+{c.styleSuggestions.length - 6}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {dialog && (
        <CategoryDialog
          key={dialog.edit?.id ?? dialog.duplicate?.id ?? "new"}
          category={dialog.edit}
          duplicateOf={dialog.duplicate}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
    </>
  );
}
