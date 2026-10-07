#!/usr/bin/env bun
/**
 * Verifies every agent CLI configured in .env (<ID>_BIN / <ID>_MODEL / AGENT_PATH)
 * can be launched headless by the app.  Usage: bun run check:agents [codex,claude,...]
 */
import { App, config } from "../packages/core/src";

const app = new App({ ...config, databasePath: ":memory:" });
const providers = (await app.providers.describe()).filter((p) => p.kind === "text");
const wanted = process.argv[2]?.split(",") ?? providers.map((p) => p.id);

const results = await Promise.all(
  providers
    .filter((p) => wanted.includes(p.id))
    .map(async (p) => {
      const started = Date.now();
      try {
        const out = await app.providers.get("text", p.id).complete({ prompt: 'Reply with only this JSON: {"ok":true}' });
        const ok = out.includes('"ok"');
        return { ...p, ok, note: ok ? `${((Date.now() - started) / 1000).toFixed(1)}s` : out.trim().slice(-120) };
      } catch (error) {
        return { ...p, ok: false, note: (error as Error).message.split("\n").filter(Boolean).pop()?.slice(0, 160) ?? "" };
      }
    }),
);

for (const r of results) console.log(`${r.ok ? "✔" : "✘"} ${r.id.padEnd(7)} ${r.detail ?? ""}  ${r.note}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
