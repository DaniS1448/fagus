import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import fs from "node:fs"
import path from "node:path"
import * as schema from "./schema"

const dataDir = path.join(process.cwd(), "data")
fs.mkdirSync(dataDir, { recursive: true })

const sqlite = new Database(path.join(dataDir, "fagus.db"))
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS designs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    width_mm REAL NOT NULL,
    height_mm REAL NOT NULL,
    sides TEXT NOT NULL,
    front_document TEXT NOT NULL,
    back_document TEXT NOT NULL,
    seed INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS designs_project_id ON designs(project_id);

  CREATE TABLE IF NOT EXISTS photo_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    width_px INTEGER NOT NULL,
    height_px INTEGER NOT NULL,
    thumbnail BLOB NOT NULL,
    bytes BLOB NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quote_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    attribution TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bible_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bible_texts (
    id TEXT PRIMARY KEY,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER NOT NULL,
    verse_end INTEGER,
    body TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS identity_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    mime TEXT,
    width_px INTEGER,
    height_px INTEGER,
    thumbnail BLOB,
    bytes BLOB,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`)

ensureColumn(
  "photos",
  "group_id",
  "ALTER TABLE photos ADD COLUMN group_id TEXT REFERENCES photo_groups(id) ON DELETE SET NULL",
)
ensureColumn(
  "quotes",
  "group_id",
  "ALTER TABLE quotes ADD COLUMN group_id TEXT REFERENCES quote_groups(id) ON DELETE SET NULL",
)
ensureColumn(
  "bible_texts",
  "group_id",
  "ALTER TABLE bible_texts ADD COLUMN group_id TEXT REFERENCES bible_groups(id) ON DELETE SET NULL",
)
ensureColumn(
  "identities",
  "group_id",
  "ALTER TABLE identities ADD COLUMN group_id TEXT REFERENCES identity_groups(id) ON DELETE SET NULL",
)

sqlite.pragma("wal_checkpoint(TRUNCATE)")

function checkpointAndClose() {
  if (!sqlite.open) return
  try {
    sqlite.pragma("wal_checkpoint(TRUNCATE)")
  } finally {
    if (sqlite.open) sqlite.close()
  }
}

process.on("exit", checkpointAndClose)
process.on("SIGINT", () => {
  process.exit(130)
})

export const db = drizzle(sqlite, { schema })

export function now(): number {
  return Date.now()
}

function ensureColumn(table: string, column: string, statement: string) {
  const rows = sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>
  if (rows.some((row) => row.name === column)) return
  sqlite.exec(statement)
}
