import { Sidebar } from "@/components/app/Sidebar";
import { useJobEvents } from "@/hooks/useJobEvents";
import { useRoute, type Route } from "@/hooks/useRoute";
import { DashboardPage } from "@/pages/DashboardPage";
import { JobsPage } from "@/pages/JobsPage";
import { ProjectPage } from "@/pages/ProjectPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { StoryPage } from "@/pages/StoryPage";

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "project":
      return <ProjectPage key={route.id} id={route.id} />;
    case "story":
      return <StoryPage key={route.id} id={route.id} />;
    case "jobs":
      return <JobsPage />;
    case "providers":
      return <ProvidersPage />;
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  const route = useRoute();
  useJobEvents();
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar route={route} />
      <main className="flex-1 overflow-y-auto">
        <Page route={route} />
      </main>
    </div>
  );
}
