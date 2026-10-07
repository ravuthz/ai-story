import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryBadge, StatusBadge } from "@/components/app/badges";
import { SelectField } from "@/components/app/fields";
import { NewStoryDialog } from "@/components/app/NewStoryDialog";
import { PageHeader } from "@/components/app/Sidebar";
import { keys, useAction, useCategories, useProject, useStories } from "@/hooks/queries";
import { href } from "@/hooks/useRoute";
import { api } from "@/lib/api";

const PAGE_SIZE = 25;
const STATUSES = ["all", "draft", "generating", "scripted", "rendering", "done", "failed"];

export function ProjectPage({ id }: { id: string }) {
  const { data: project } = useProject(id);
  const { data: categories = [] } = useCategories();
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const { data } = useStories({
    projectId: id,
    category: category === "all" ? undefined : category,
    status: status === "all" ? undefined : status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const remove = useAction(api.deleteProject, { success: "Project deleted", invalidate: [keys.projects] });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const filter = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(0);
  };

  return (
    <>
      <PageHeader
        title={project?.name ?? "…"}
        description={project && <>storage/{project.slug}/&lt;story&gt;/{"{images,audios,videos}"} · {project.description}</>}
        actions={
          <>
            <Button onClick={() => setCreating(true)}>
              <Sparkles /> Generate stories
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete project"
              onClick={() => {
                if (confirm("Delete this project and all of its files?"))
                  remove.mutate(id, { onSuccess: () => (window.location.hash = href.dashboard) });
              }}
            >
              <Trash2 />
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-8">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            className="w-52"
            label="Category"
            value={category}
            options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
            onChange={filter(setCategory)}
          />
          <SelectField
            className="w-40"
            label="Status"
            value={status}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={filter(setStatus)}
          />
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">{data?.total ?? 0} stories</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Scenes / duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => (window.location.hash = href.story(s.id))}>
                <TableCell className="max-w-md">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.synopsis || s.blueprint.setting}</div>
                </TableCell>
                <TableCell>
                  <CategoryBadge category={s.category} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {s.settings.sceneCount} · {s.settings.durationSec}s · {s.settings.narrationLanguage}
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {!data?.items.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No stories yet. Click “Generate stories”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm tabular-nums">
            {page + 1} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
      <NewStoryDialog projectId={id} open={creating} onOpenChange={setCreating} />
    </>
  );
}
