import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/Sidebar";
import { useCategories, useJobs, useProjects } from "@/hooks/queries";
import { href } from "@/hooks/useRoute";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function DashboardPage() {
  const { data: categories = [] } = useCategories();
  const { data: projects = [] } = useProjects();
  const { data: jobs } = useJobs();
  const total = categories.reduce((n, c) => n + c.count, 0);

  return (
    <>
      <PageHeader title="Dashboard" description={`Unique narrated story videos across ${categories.length || "your"} categories.`} />
      <div className="grid gap-8 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Stories" value={total.toLocaleString()} />
          <Stat label="Projects" value={projects.length} />
          <Stat label="Jobs running" value={jobs?.counts.running ?? 0} />
          <Stat label="Jobs queued" value={jobs?.counts.queued ?? 0} />
        </div>
        <section className="grid gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Categories</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">{c.emoji}</span> {c.label}
                  </CardTitle>
                  <CardDescription>{c.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Progress value={(c.count / c.capacity) * 100} />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {c.count.toLocaleString()} generated · {c.capacity.toLocaleString()} unique combinations
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        {!projects.length && (
          <p className="text-sm text-muted-foreground">
            Create a project from the sidebar (<b>+</b>) to start generating stories.
          </p>
        )}
        {projects.length > 0 && (
          <section className="grid gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <a key={p.id} href={href.project(p.id)}>
                  <Card size="sm" className="transition-colors hover:bg-accent/40">
                    <CardHeader>
                      <CardTitle>{p.name}</CardTitle>
                      <CardDescription>
                        {p.storyCount} stories · storage/{p.slug}/
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
