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

## Agent CLIs

> Providers live in the database and are edited on the **Providers** page (or via the API / MCP tools below). The `.env` values in this section and `providers.config.json` are imported **once**, on the first start, and are ignored after that.

Every agent CLI is resolved from its configured executable path, so the app works even when it's started with a minimal `PATH` (MCP clients, GUI apps, launchd):

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

Each provider is a row in the `providers` table: a **type** (driver), an **id** that stories refer to, a label, an enabled flag, whether it is the default for its kind, and the driver's settings (secrets are masked in API responses). One type can back several providers, e.g. two Qwen spaces or a second `claude` with another model. Changes apply to the running server immediately; restart the MCP server to pick them up there.

| Kind  | id       | Notes |
|-------|----------|-------|
| text  | `codex`  | `codex exec` (read-only sandbox) |
| text  | `claude` | `claude --print` (no tools, prompt via stdin) |
| text  | `gemini` | `gemini -p` (plan mode) |
| text  | `agy`    | Antigravity `agy --print` (+ `--json-schema`) |
| text  | `omp`    | `omp --print --no-session` |
| image | `codex`  | Local Codex CLI `image_generation` tool, sandboxed to a scratch folder |
| image | `qwen`, `qwen-image-2-1` | Qwen-Image via Gradio; `qwen-image-2-1` falls back across 4 spaces |
| image | `gemini` | Gemini image API (API key) |
| audio | `edge`   | Edge neural TTS: `km-KH-SreymomNeural`, `km-KH-PisethNeural`, English voices |
| audio | `gemini` | Gemini TTS |
| video | `ffmpeg` | Local Ken Burns motion (zoom/pan) with fades, 30fps H.264 |
| audio | `voxcpm` | VoxCPM 2 TTS via Gradio, falls back across 3 servers |
| video | `gradio` | Remote image-to-video Gradio app, muxed with narration |
| any   | Gradio   | Any Gradio app (types `gradio-text`, `gradio-image`, `gradio-audio`, `gradio-video`; see below) |
| any   | MCP      | Any MCP tool (types `mcp-image`, `mcp-audio`, `mcp-video`; see below) |

### Gradio providers (HF Space, remote URL or local app)

Every kind can use Gradio apps. A Gradio provider holds an ordered list of **connections**: the first enabled one is tried, and if it fails (error, busy space, timeout) the next one is used. Each connection has a `space` (an HF Space id `owner/name`, a remote URL, or a local server like `http://127.0.0.1:7860`), an `apiName`, named `params` with `{{placeholders}}`, and optional `valueMaps` that translate a placeholder's value into what that app expects. The HF token is only sent to Hugging Face hosts.

```json
{
  "type": "gradio-image",
  "slug": "qwen-image-2-1",
  "config": {
    "timeoutSec": 300,
    "connections": [
      { "space": "hugging-apps/qwen-image-2-1", "apiName": "/generate",
        "params": { "prompt": "{{prompt}}", "aspect_ratio": "{{aspectRatio}}", "resolution": 1024 } },
      { "space": "arudradey/qwen-image-2.1-uncensored-gguf", "apiName": "/generate",
        "params": { "prompt": "{{prompt}}", "aspect_ratio": "{{aspectRatio}}", "randomize_seed": true },
        "valueMaps": { "aspectRatio": { "9:16": "Portrait · 9:16 (768x1344)", "16:9": "Landscape · 16:9 (1344x768)", "1:1": "Square · 1:1 (1024x1024)" } } }
    ]
  }
}
```

Placeholders: text `prompt` · image `prompt, aspectRatio, width, height, seed` · audio `text, language, voice` · video `prompt, imagePath, durationSec, seed`. Audio keeps the file type the app returns (e.g. `.wav`).

### Cloned voices (VoxCPM and other Gradio TTS apps)

Gradio audio providers can hold **voices**: a short reference clip (5–30s of clean speech), an optional transcript of the clip, and an optional style. Manage them with **Voices** on the provider's row (Providers → Audio), then pick one as the story's **Voice**. Placeholders for the connection params: `{{voiceFile}}` (the clip, uploaded to the app), `{{voiceTranscript}}`, `{{useTranscript}}` (true when a transcript is set) and `{{voiceStyle}}`; with no voice selected they are `null` / `""` / `false`, so the app uses its default voice. Clips are stored in `storage/_voices/`.

### MCP media providers

On the Providers page click **Add** on a card and pick an MCP type, or `POST /api/provider-configs`:

```json
{
  "type": "mcp-image",
  "slug": "my-image-mcp",
  "config": {
    "server": { "command": "npx", "args": ["-y", "some-image-mcp"] },
    "tool": "generate_image",
    "arguments": { "prompt": "{{prompt}}", "aspect_ratio": "{{aspectRatio}}" }
  }
}
```

Placeholders: image `prompt, aspectRatio` · audio `text, language, voice` · video `prompt, imagePath, durationSec`.
`server` can also be `{ "url": "https://…/mcp" }` (Streamable HTTP). The tool can return inline base64 media, an embedded blob, or a URL/file path.

## MCP server (use the app from Codex / Gemini / agy / omp / Claude)

```bash
codex mcp add ai-story -- bun /abs/path/ai-story/apps/mcp/src/index.ts
gemini mcp add ai-story bun /abs/path/ai-story/apps/mcp/src/index.ts
```

Tools: `list_categories`, `list_providers`, `list_voices`, `create_voice`, `list_provider_configs`, `list_provider_types`, `create_provider`, `update_provider`, `set_default_provider`, `list_projects`, `create_project`, `list_stories`, `get_story`, `generate_story`, `generate_batch`, `update_story_settings`, `update_scene`, `render_story`, `get_job`.

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
GET  /api/categories            GET  /api/providers
GET  /api/provider-configs      POST /api/provider-configs  { type, slug, label?, config? }
GET  /api/provider-configs/drivers   PATCH /api/provider-configs/:id { label?, enabled?, config? }
POST /api/provider-configs/:id/default   DELETE /api/provider-configs/:id
GET  /api/voices?audio&language  (voice choices for a story)
GET  /api/voices/provider/:providerId   POST (multipart: name, file, transcript?, style?)
PATCH /api/voices/:id (multipart, file optional)   DELETE /api/voices/:id
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
  providers/     interfaces, ProviderRegistry, drivers (type → provider + config fields), seed (one-time .env import)
    cli/         CliRunner, CliAgent base + Codex/Gemini/Agy/Omp agents
    text/ image/ audio/ video/ mcp/
  services/      ProjectService, ProviderService, StoryService, RenderService, JobQueue
  storage/       ProjectStorage (project/story/{images,audios,videos})
  App.ts         composition root
apps/server      Hono REST API + SSE + static files
apps/mcp         MCP stdio server
apps/web         React + TypeScript + shadcn/ui (Base UI) + TanStack Query
```

To add a provider, implement `ImageProvider` / `AudioProvider` / `VideoProvider` / `TextProvider` (or extend `CliAgent`, `RemoteVideoProvider` or `BaseProvider`) and add a driver for it in `providers/drivers.ts`; it then shows up under **Add** on the Providers page.
To add a category, add an entry to `domain/categories/catalog.ts` and its id to `CATEGORY_IDS`.
