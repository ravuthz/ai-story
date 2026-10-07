# AI Story Studio

Generate thousands of unique, narrated motion-video stories with Khmer (or English) narration.

**Categories:** horror-story · love-story · motivation · philosophy · quotes · folklore · kid-story.
Each category has 40,000 unique seed combinations.

## Quick start

```bash
cp .env.example .env      # set GEMINI_API_KEY / HF_TOKEN if you use those providers
bun install
bun run dev               # API on :3001 + web UI on :5173
```

Requirements: Bun ≥ 1.3 and ffmpeg/ffprobe on `PATH`, plus whichever agent CLIs you want to use (`codex`, `gemini`, `agy`, `omp`).

## How it works

```
blueprint (unique seeds) ──► text provider writes script (EN text + Khmer narration + image prompts)
                                 │
          ┌──────────────────────┼──────────────────────┐
     image provider        audio provider         (per scene)
          └──────────► video provider: motion clip ◄────┘
                                 │
                       ffmpeg concat ──► final .mp4
```

- **Uniqueness:** every story is built from a *blueprint*, one pick each of theme, setting, protagonist, twist and tone. Its SHA-1 fingerprint is a `UNIQUE` column in SQLite, so a combination is never reused. The generator walks the combination space in a pseudo-random order that visits every combination exactly once.
- **Per-story settings:** scene count, total duration (split across scenes, and each scene can be edited), narration language (`km`/`en`), aspect ratio, image style, voice, and a provider override for each kind. A clip is extended automatically when its narration runs longer than the scene.
- **Jobs:** generation and rendering run in a SQLite-backed queue that survives restarts. A batch of 1000 creates 1000 drafts, each with a reserved unique blueprint, then 1000 independent `generate-story` jobs that can be retried one by one.

## Agent CLIs (`.env`)

Every agent CLI is resolved from `.env`, so the app works even when it's started with a minimal `PATH` (MCP clients, GUI apps, launchd):

```ini
CODEX_BIN=/opt/homebrew/bin/codex
CODEX_MODEL=gpt-5.5            # optional override; blank = the CLI's own config
CLAUDE_BIN=~/.local/bin/claude
AGY_BIN=~/.local/bin/agy
OMP_BIN=~/.bun/bin/omp
GEMINI_BIN=gemini
AGENT_PATH=/opt/homebrew/bin:~/.bun/bin:~/.local/bin   # extra PATH for hooks/shebangs (node, bun)
# A CLI's own config-location vars pass straight through, e.g. CODEX_HOME=~/.codex-story
```

- `~/` is expanded, including inside `AGENT_PATH`.
- Each binary's folder is put first on `PATH` when it runs.
- `bun run check:agents` runs a tiny prompt through every configured CLI and prints the resolved path, the model, and pass/fail.

## Providers

| Kind  | id       | Notes |
|-------|----------|-------|
| text  | `codex`  | `codex exec` (read-only sandbox) |
| text  | `claude` | `claude --print` (no tools, prompt via stdin) |
| text  | `gemini` | `gemini -p` (plan mode) |
| text  | `agy`    | Antigravity `agy --print` (+ `--json-schema`) |
| text  | `omp`    | `omp --print --no-session` |
| image | `codex`  | Local Codex CLI `image_generation` tool, sandboxed to a scratch folder |
| image | `qwen`   | Remote Qwen-Image via Gradio (`QWEN_GRADIO_URL`, HF Space id or URL) |
| image | `gemini` | Gemini image API (`GEMINI_API_KEY`) |
| audio | `edge`   | Edge neural TTS: `km-KH-SreymomNeural`, `km-KH-PisethNeural`, English voices |
| audio | `gemini` | Gemini TTS |
| video | `ffmpeg` | Local Ken Burns motion (zoom/pan) with fades, 30fps H.264 |
| video | `gradio` | Remote image-to-video Gradio app (`VIDEO_GRADIO_URL`), muxed with narration |
| any   | MCP      | Any MCP tool via `providers.config.json` (see below) |

### MCP media providers

Create `providers.config.json` in the repo root:

```json
{
  "mcp": [
    {
      "id": "my-image-mcp",
      "kind": "image",
      "server": { "command": "npx", "args": ["-y", "some-image-mcp"] },
      "tool": "generate_image",
      "arguments": { "prompt": "{{prompt}}", "aspect_ratio": "{{aspectRatio}}" }
    }
  ]
}
```

Placeholders: image `prompt, aspectRatio` · audio `text, language, voice` · video `prompt, imagePath, durationSec`.
`server` can also be `{ "url": "https://…/mcp" }` (Streamable HTTP). The tool can return inline base64 media, an embedded blob, or a URL/file path.

## MCP server (use the app from Codex / Gemini / agy / omp / Claude)

```bash
codex mcp add ai-story -- bun /abs/path/ai-story/apps/mcp/src/index.ts
gemini mcp add ai-story bun /abs/path/ai-story/apps/mcp/src/index.ts
```

Tools: `list_categories`, `list_providers`, `list_projects`, `create_project`, `list_stories`, `get_story`, `generate_story`, `generate_batch`, `update_story_settings`, `update_scene`, `render_story`, `get_job`.

## Storage layout

```
storage/
  ai-story.sqlite
  <project-slug>/
    <story-slug>/
      story.json            # manifest: story, settings, scenes
      images/scene-01.png
      audios/scene-01.mp3
      videos/scene-01.mp4
      <story-slug>.mp4      # final video
```

## REST API (selected)

```
GET  /api/categories            GET  /api/providers         GET /api/voices
GET  /api/projects              POST /api/projects          DELETE /api/projects/:id
GET  /api/stories?projectId&category&status&limit&offset
POST /api/stories               { projectId, category, settings?, render? }
POST /api/stories/batch         { projectId, category, count, settings?, render? }
GET  /api/stories/:id           PATCH /api/stories/:id/settings
POST /api/stories/:id/generate  POST /api/stories/:id/render { steps?, force?, sceneIds? }
PATCH /api/scenes/:id           GET /api/jobs   GET /api/jobs/events (SSE)
GET  /files/<project>/<story>/… (generated assets)
```

## Code map

```
packages/core/src
  domain/        types, zod schemas, category catalog, BlueprintGenerator
  db/            Database (bun:sqlite + migrations), BaseRepository<T> + repositories
  providers/     interfaces, ProviderRegistry, ProviderFactory
    cli/         CliRunner, CliAgent base + Codex/Gemini/Agy/Omp agents
    text/ image/ audio/ video/ mcp/
  services/      ProjectService, StoryService, RenderService, JobQueue
  storage/       ProjectStorage (project/story/{images,audios,videos})
  App.ts         composition root
apps/server      Hono REST API + SSE + static files
apps/mcp         MCP stdio server
apps/web         React + TypeScript + shadcn/ui (Base UI) + TanStack Query
```

To add a provider, implement `ImageProvider` / `AudioProvider` / `VideoProvider` / `TextProvider` (or extend `CliAgent`, `RemoteVideoProvider` or `BaseProvider`) and register it in `providers/factory.ts`.
To add a category, add an entry to `domain/categories/catalog.ts` and its id to `CATEGORY_IDS`.
