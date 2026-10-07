import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/Sidebar";
import { useProviders } from "@/hooks/queries";

const KINDS = [
  { kind: "text", title: "Story writers", hint: "Headless agent CLIs: codex, claude, gemini, agy, omp (paths from .env)" },
  { kind: "image", title: "Image", hint: "Codex CLI (local), Qwen-Image (Gradio), Gemini, or MCP" },
  { kind: "audio", title: "Narration", hint: "Edge TTS has native Khmer voices; Gemini TTS; or MCP" },
  { kind: "video", title: "Motion video", hint: "FFmpeg Ken Burns locally, Gradio image-to-video, or MCP" },
] as const;

const MCP_EXAMPLE = `// providers.config.json (project root)
{
  "mcp": [{
    "id": "flux-mcp",
    "kind": "image",
    "server": { "command": "npx", "args": ["-y", "some-image-mcp"] },
    "tool": "generate_image",
    "arguments": { "prompt": "{{prompt}}", "aspect_ratio": "{{aspectRatio}}" }
  }]
}`;

export function ProvidersPage() {
  const { data } = useProviders();

  return (
    <>
      <PageHeader title="Providers" description="Defaults come from .env; every story can override them in its settings." />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        {KINDS.map(({ kind, title, hint }) => (
          <Card key={kind}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{hint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data?.providers
                .filter((p) => p.kind === kind)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-mono text-xs text-muted-foreground">{p.id}</span> · {p.label}
                      {data.defaults[kind] === p.id && <Badge className="ml-2">default</Badge>}
                      {p.detail && <span className="block truncate font-mono text-xs text-muted-foreground">{p.detail}</span>}
                    </span>
                    <span className={p.available ? "text-emerald-400" : "text-muted-foreground"}>{p.available ? "ready" : "not configured"}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Add MCP media providers</CardTitle>
            <CardDescription>Any MCP tool that returns an image/audio/video (inline, URL or file path) can be plugged in.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">{MCP_EXAMPLE}</pre>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
