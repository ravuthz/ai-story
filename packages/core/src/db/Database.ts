import { Database as SQLite } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRATIONS } from "./migrations";

export class Database {
  readonly sql: SQLite;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.sql = new SQLite(path, { create: true, strict: true });
    this.sql.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.migrate();
  }

  transaction<T>(fn: () => T): T {
    return this.sql.transaction(fn)();
  }

  /** Runs a one-time data step (recorded in `meta` under `key`) in a transaction. Never rename an applied key. */
  runOnce(key: string, step: () => void): void {
    const done = this.sql.query<{ value: string }, { key: string }>("SELECT value FROM meta WHERE key = $key").get({ key });
    if (done) return;
    this.transaction(() => {
      step();
      this.sql.query("INSERT INTO meta (key, value) VALUES ($key, $value)").run({ key, value: new Date().toISOString() });
    });
  }

  private migrate(): void {
    this.sql.exec("CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)");
    const applied = new Set(
      this.sql.query<{ version: number }, []>("SELECT version FROM _migrations").all().map((r) => r.version),
    );
    MIGRATIONS.forEach((statement, i) => {
      const version = i + 1;
      if (applied.has(version)) return;
      this.transaction(() => {
        this.sql.exec(statement);
        this.sql.query("INSERT INTO _migrations (version) VALUES ($version)").run({ version });
      });
    });
  }
}
