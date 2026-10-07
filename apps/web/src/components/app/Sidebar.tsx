import { Activity, FolderOpen, LayoutDashboard, Monitor, Moon, Plus, Settings2, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useJobs, useProjects } from "@/hooks/queries";
import { href, type Route } from "@/hooks/useRoute";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { CreateProjectDialog } from "./CreateProjectDialog";

function NavLink({ to, active, icon: Icon, children, trailing }: { to: string; active: boolean; icon: typeof Activity; children: string; trailing?: React.ReactNode }) {
  return (
    <a
      href={to}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
      {trailing && <span className="ml-auto">{trailing}</span>}
    </a>
  );
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex gap-0.5 rounded-lg border p-0.5" role="group" aria-label="Theme">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          size="xs"
          variant={theme === value ? "secondary" : "ghost"}
          className="flex-1"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          <Icon /> {label}
        </Button>
      ))}
    </div>
  );
}

export function Sidebar({ route }: { route: Route }) {
  const { data: projects = [] } = useProjects();
  const { data: jobs } = useJobs();
  const [creating, setCreating] = useState(false);
  const active = (jobs?.counts.running ?? 0) + (jobs?.counts.queued ?? 0);

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="px-4 py-4">
        <a href={href.dashboard} className="text-base font-semibold tracking-tight">
          📚 AI Story Studio
        </a>
      </div>
      <nav className="grid gap-0.5 px-2">
        <NavLink to={href.dashboard} active={route.page === "dashboard"} icon={LayoutDashboard}>Dashboard</NavLink>
        <NavLink
          to={href.jobs}
          active={route.page === "jobs"}
          icon={Activity}
          trailing={active > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{active}</span>}
        >
          Jobs
        </NavLink>
        <NavLink to={href.providers} active={route.page === "providers"} icon={Settings2}>Providers</NavLink>
      </nav>
      <Separator className="my-3" />
      <div className="flex items-center justify-between px-4 pb-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projects</span>
        <Button size="icon-xs" variant="ghost" onClick={() => setCreating(true)} aria-label="New project">
          <Plus />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="grid gap-0.5 pb-4">
          {projects.map((p) => (
            <NavLink
              key={p.id}
              to={href.project(p.id)}
              active={route.page === "project" && route.id === p.id}
              icon={FolderOpen}
              trailing={<span className="text-xs tabular-nums">{p.storyCount}</span>}
            >
              {p.name}
            </NavLink>
          ))}
          {!projects.length && <p className="px-2.5 py-2 text-xs text-muted-foreground">No projects yet.</p>}
        </div>
      </ScrollArea>
      <div className="border-t p-2">
        <ThemeToggle />
      </div>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </aside>
  );
}

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-8 py-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
