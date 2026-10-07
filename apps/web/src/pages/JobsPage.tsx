import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/Sidebar";
import { useJobs } from "@/hooks/queries";
import { href } from "@/hooks/useRoute";

export function JobsPage() {
  const { data } = useJobs();
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader
        title="Jobs"
        description={Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ")}
      />
      <div className="p-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-64">Progress</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((job) => {
              const storyId = job.payload.storyId as string | undefined;
              return (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    {storyId ? <a className="hover:underline" href={href.story(storyId)}>{job.type}</a> : job.type}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>
                    <Progress value={job.progress * 100} />
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground" title={job.error ?? job.message}>
                    {job.error ?? job.message}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{new Date(job.updatedAt).toLocaleTimeString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
