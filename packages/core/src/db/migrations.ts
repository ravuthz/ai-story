/** Append-only list of schema migrations. Never edit an applied entry. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE stories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    synopsis TEXT NOT NULL DEFAULT '',
    moral TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    fingerprint TEXT NOT NULL UNIQUE,
    blueprint TEXT NOT NULL,
    settings TEXT NOT NULL,
    video_path TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (project_id, slug)
  );
  CREATE INDEX idx_stories_project ON stories(project_id);
  CREATE INDEX idx_stories_category ON stories(category);

  CREATE TABLE scenes (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    text TEXT NOT NULL,
    narration TEXT NOT NULL,
    image_prompt TEXT NOT NULL,
    motion TEXT NOT NULL,
    duration_sec REAL NOT NULL,
    image_path TEXT,
    audio_path TEXT,
    video_path TEXT,
    UNIQUE (story_id, idx)
  );

  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT '',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_jobs_status ON jobs(status);
  `,
  `
  CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (kind, slug)
  );
  `,
  `
  CREATE TABLE voices (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    transcript TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_voices_provider ON voices(provider_id);
  `,
  `
  ALTER TABLE voices ADD COLUMN mode TEXT NOT NULL DEFAULT 'clone';
  `,
];
