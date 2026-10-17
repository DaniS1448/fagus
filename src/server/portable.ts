import Database from "better-sqlite3"
import { eq } from "drizzle-orm"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseSideDocument, type SideDocument } from "../domain/document"
import { includedLibraries, libraryFilename, remapGroupId, remapSide, selectionForDesigns, type IdMaps, type LibraryScope } from "../domain/portable"
import { db, now } from "./db"
import { bibleGroups, bibleTexts, designs, identities, identityGroups, photoGroups, photos, projects, quoteGroups, quotes } from "./schema"

export class PortableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PortableError"
  }
}

const FORMAT_VERSION = 1

export function exportBundle(projectId: string): { bytes: Buffer; filename: string } | null {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) return null
  const designRows = db.select().from(designs).where(eq(designs.projectId, projectId)).all()
  const quoteRows = db.select().from(quotes).all()
  const bibleRows = db.select().from(bibleTexts).all()
  const identityRows = db.select().from(identities).all()
  const photoRows = db.select().from(photos).all()
  const quoteGroupRows = db.select().from(quoteGroups).all()
  const bibleGroupRows = db.select().from(bibleGroups).all()
  const identityGroupRows = db.select().from(identityGroups).all()
  const groupRows = db.select().from(photoGroups).all()

  const sides = designRows.flatMap((row) => [parseStored(row.frontDocument), parseStored(row.backDocument)])
  const selection = selectionForDesigns(sides, {
    quotes: quoteRows,
    bibleTexts: bibleRows,
    identities: identityRows,
    photos: photoRows.map((photo) => ({ id: photo.id, groupId: photo.groupId })),
  })

  const filePath = path.join(os.tmpdir(), `fagus-${crypto.randomUUID()}.fagus`)
  const bundle = new Database(filePath)
  try {
    bundle.exec(`
      CREATE TABLE bundle_meta (version INTEGER NOT NULL, kind TEXT NOT NULL, scope TEXT);
      CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE design (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        width_mm REAL NOT NULL,
        height_mm REAL NOT NULL,
        sides TEXT NOT NULL,
        front_document TEXT NOT NULL,
        back_document TEXT NOT NULL,
        seed INTEGER NOT NULL
      );
      CREATE TABLE quote_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE quote (id TEXT PRIMARY KEY, group_id TEXT, body TEXT NOT NULL, attribution TEXT NOT NULL);
      CREATE TABLE bible_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE bible_text (
        group_id TEXT,
        id TEXT PRIMARY KEY,
        book TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse_start INTEGER NOT NULL,
        verse_end INTEGER,
        body TEXT NOT NULL,
        translation TEXT NOT NULL
      );
      CREATE TABLE identity_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE identity (
        group_id TEXT,
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        mime TEXT,
        width_px INTEGER,
        height_px INTEGER,
        thumbnail BLOB,
        bytes BLOB
      );
      CREATE TABLE photo_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE photo (
        id TEXT PRIMARY KEY,
        group_id TEXT,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        width_px INTEGER NOT NULL,
        height_px INTEGER NOT NULL,
        thumbnail BLOB NOT NULL,
        bytes BLOB NOT NULL
      );
    `)
    const insert = bundle.transaction(() => {
      bundle.prepare("INSERT INTO bundle_meta (version, kind) VALUES (?, ?)").run(FORMAT_VERSION, "project")
      bundle.prepare("INSERT INTO project (id, name) VALUES (?, ?)").run(project.id, project.name)
      const insertDesign = bundle.prepare(
        "INSERT INTO design (id, name, width_mm, height_mm, sides, front_document, back_document, seed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      for (const row of designRows) {
        insertDesign.run(row.id, row.name, row.widthMm, row.heightMm, row.sides, row.frontDocument, row.backDocument, row.seed)
      }
      const insertQuoteGroup = bundle.prepare("INSERT INTO quote_group (id, name) VALUES (?, ?)")
      for (const row of quoteGroupRows.filter((item) => selection.quoteGroupIds.includes(item.id))) {
        insertQuoteGroup.run(row.id, row.name)
      }
      const insertQuote = bundle.prepare("INSERT INTO quote (id, group_id, body, attribution) VALUES (?, ?, ?, ?)")
      for (const row of quoteRows.filter((item) => selection.quoteIds.includes(item.id))) {
        insertQuote.run(row.id, row.groupId, row.body, row.attribution)
      }
      const insertBibleGroup = bundle.prepare("INSERT INTO bible_group (id, name) VALUES (?, ?)")
      for (const row of bibleGroupRows.filter((item) => selection.bibleGroupIds.includes(item.id))) {
        insertBibleGroup.run(row.id, row.name)
      }
      const insertBible = bundle.prepare(
        "INSERT INTO bible_text (id, group_id, book, chapter, verse_start, verse_end, body, translation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      for (const row of bibleRows.filter((item) => selection.bibleTextIds.includes(item.id))) {
        insertBible.run(row.id, row.groupId, row.book, row.chapter, row.verseStart, row.verseEnd, row.body, row.translation)
      }
      const insertIdentityGroup = bundle.prepare("INSERT INTO identity_group (id, name) VALUES (?, ?)")
      for (const row of identityGroupRows.filter((item) => selection.identityGroupIds.includes(item.id))) {
        insertIdentityGroup.run(row.id, row.name)
      }
      const insertIdentity = bundle.prepare(
        "INSERT INTO identity (id, group_id, kind, name, text, mime, width_px, height_px, thumbnail, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      for (const row of identityRows.filter((item) => selection.identityIds.includes(item.id))) {
        insertIdentity.run(row.id, row.groupId, row.kind, row.name, row.text, row.mime, row.widthPx, row.heightPx, row.thumbnail, row.bytes)
      }
      const insertGroup = bundle.prepare("INSERT INTO photo_group (id, name) VALUES (?, ?)")
      for (const row of groupRows.filter((item) => selection.groupIds.includes(item.id))) {
        insertGroup.run(row.id, row.name)
      }
      const insertPhoto = bundle.prepare(
        "INSERT INTO photo (id, group_id, name, mime, width_px, height_px, thumbnail, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      for (const row of photoRows.filter((item) => selection.photoIds.includes(item.id))) {
        insertPhoto.run(row.id, row.groupId, row.name, row.mime, row.widthPx, row.heightPx, row.thumbnail, row.bytes)
      }
    })
    insert()
  } finally {
    bundle.close()
  }
  const bytes = fs.readFileSync(filePath)
  fs.unlinkSync(filePath)
  return { bytes, filename: "proyecto.fagus" }
}

export function importBundle(bytes: Buffer): string {
  if (!bytes.subarray(0, 15).toString("utf8").startsWith("SQLite format 3")) {
    throw new PortableError("Este archivo no es un proyecto de Fagus")
  }
  const filePath = path.join(os.tmpdir(), `fagus-import-${crypto.randomUUID()}.fagus`)
  fs.writeFileSync(filePath, bytes)
  const bundle = new Database(filePath, { readonly: true, fileMustExist: true })
  try {
    const meta = readMeta(bundle)
    if (meta.version !== FORMAT_VERSION) throw new PortableError("Este archivo es de otra versión de Fagus")
    if (meta.kind === "library") throw new PortableError("Este archivo es una biblioteca, no un proyecto")
    if (meta.kind !== "project") throw new PortableError("Este archivo no es un proyecto de Fagus")
    const project = bundle.prepare("SELECT id, name FROM project").get() as { id: string; name: string } | undefined
    if (!project) throw new PortableError("Este archivo no es un proyecto de Fagus")
    const designRows = bundle
      .prepare("SELECT id, name, width_mm, height_mm, sides, front_document, back_document, seed FROM design")
      .all() as Array<{
      id: string
      name: string
      width_mm: number
      height_mm: number
      sides: string
      front_document: string
      back_document: string
      seed: number
    }>
    const quoteRows = readQuotes(bundle)
    const bibleRows = readBible(bundle)
    const identityRows = readIdentities(bundle)
    const quoteGroupRows = readGroups(bundle, "quote_group")
    const bibleGroupRows = readGroups(bundle, "bible_group")
    const identityGroupRows = readGroups(bundle, "identity_group")
    const groupRows = readGroups(bundle, "photo_group")
    const photoRows = readPhotos(bundle)

    const ids: IdMaps = {
      quotes: freshIds(quoteRows.map((row) => row.id)),
      bibleTexts: freshIds(bibleRows.map((row) => row.id)),
      identities: freshIds(identityRows.map((row) => row.id)),
      photos: freshIds(photoRows.map((row) => row.id)),
    }
    const groupMap = freshIds(groupRows.map((row) => row.id))
    const quoteGroupMap = freshIds(quoteGroupRows.map((row) => row.id))
    const bibleGroupMap = freshIds(bibleGroupRows.map((row) => row.id))
    const identityGroupMap = freshIds(identityGroupRows.map((row) => row.id))
    const projectId = crypto.randomUUID()
    const timestamp = now()

    db.transaction((tx) => {
      tx.insert(projects).values({ id: projectId, name: project.name, createdAt: timestamp, updatedAt: timestamp }).run()
      if (quoteGroupRows.length > 0) {
        tx.insert(quoteGroups)
          .values(quoteGroupRows.map((row) => ({ id: quoteGroupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (bibleGroupRows.length > 0) {
        tx.insert(bibleGroups)
          .values(bibleGroupRows.map((row) => ({ id: bibleGroupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (identityGroupRows.length > 0) {
        tx.insert(identityGroups)
          .values(identityGroupRows.map((row) => ({ id: identityGroupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (groupRows.length > 0) {
        tx.insert(photoGroups)
          .values(groupRows.map((row) => ({ id: groupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (quoteRows.length > 0) {
        tx.insert(quotes)
          .values(
            quoteRows.map((row) => ({
              id: ids.quotes.get(row.id) ?? row.id,
              groupId: remapGroupId(row.group_id, quoteGroupMap),
              body: row.body,
              attribution: row.attribution,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          )
          .run()
      }
      if (bibleRows.length > 0) {
        tx.insert(bibleTexts)
          .values(
            bibleRows.map((row) => ({
              id: ids.bibleTexts.get(row.id) ?? row.id,
              groupId: remapGroupId(row.group_id, bibleGroupMap),
              book: row.book,
              chapter: row.chapter,
              verseStart: row.verse_start,
              verseEnd: row.verse_end,
              body: row.body,
              translation: row.translation,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          )
          .run()
      }
      if (identityRows.length > 0) {
        tx.insert(identities)
          .values(
            identityRows.map((row) => ({
              id: ids.identities.get(row.id) ?? row.id,
              groupId: remapGroupId(row.group_id, identityGroupMap),
              kind: row.kind,
              name: row.name,
              text: row.text,
              mime: row.mime,
              widthPx: row.width_px,
              heightPx: row.height_px,
              thumbnail: row.thumbnail,
              bytes: row.bytes,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          )
          .run()
      }
      if (photoRows.length > 0) {
        tx.insert(photos)
          .values(
            photoRows.map((row) => ({
              id: ids.photos.get(row.id) ?? row.id,
              groupId: remapGroupId(row.group_id, groupMap),
              name: row.name,
              mime: row.mime,
              widthPx: row.width_px,
              heightPx: row.height_px,
              thumbnail: row.thumbnail,
              bytes: row.bytes,
              createdAt: timestamp,
            })),
          )
          .run()
      }
      if (designRows.length > 0) {
        tx.insert(designs)
          .values(
            designRows.map((row) => {
              const front = remapSide(parseStored(row.front_document), ids)
              const back = remapSide(parseStored(row.back_document), ids)
              return {
                id: crypto.randomUUID(),
                projectId,
                name: row.name,
                widthMm: row.width_mm,
                heightMm: row.height_mm,
                sides: row.sides === "double" ? "double" : "single",
                frontDocument: JSON.stringify(front),
                backDocument: JSON.stringify(back),
                seed: row.seed,
                createdAt: timestamp,
                updatedAt: timestamp,
              }
            }),
          )
          .run()
      }
    })
    return projectId
  } catch (error) {
    if (error instanceof PortableError) throw error
    throw new PortableError("Este archivo no es un proyecto de Fagus")
  } finally {
    bundle.close()
    fs.unlinkSync(filePath)
  }
}

function parseStored(value: string): SideDocument {
  try {
    return parseSideDocument(JSON.parse(value))
  } catch {
    return parseSideDocument(null)
  }
}

function freshIds(ids: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const id of ids) map.set(id, crypto.randomUUID())
  return map
}

export function exportLibrary(scope: LibraryScope, group?: { id: string; name: string }): { bytes: Buffer; filename: string } {
  const include = includedLibraries(scope)
  const groupId = group?.id
  const filePath = path.join(os.tmpdir(), `fagus-${crypto.randomUUID()}.fagus`)
  const bundle = new Database(filePath)
  try {
    bundle.exec(librarySchema())
    const insert = bundle.transaction(() => {
      bundle.prepare("INSERT INTO bundle_meta (version, kind, scope) VALUES (?, ?, ?)").run(FORMAT_VERSION, "library", scope)
      if (include.quotes) writeQuotes(bundle, groupId)
      if (include.bible) writeBible(bundle, groupId)
      if (include.identities) writeIdentities(bundle, groupId)
      if (include.photos) writePhotos(bundle, groupId)
    })
    insert()
  } finally {
    bundle.close()
  }
  const bytes = fs.readFileSync(filePath)
  fs.unlinkSync(filePath)
  return { bytes, filename: libraryFilename(scope, group?.name) }
}

export function importLibrary(bytes: Buffer, expected: LibraryScope): void {
  const opened = openBundle(bytes, "Este archivo no es una biblioteca de Fagus")
  const bundle = opened.bundle
  try {
    const meta = readMeta(bundle)
    if (meta.version !== FORMAT_VERSION) throw new PortableError("Este archivo es de otra versión de Fagus")
    if (meta.kind === "project") throw new PortableError("Este archivo es un proyecto, no una biblioteca")
    if (meta.kind !== "library" || !meta.scope) throw new PortableError("Este archivo no es una biblioteca de Fagus")
    if (meta.scope !== expected) {
      throw new PortableError(`Este archivo es de ${scopeLabel(meta.scope)}, no de ${scopeLabel(expected)}`)
    }
    const quoteGroupRows = readGroups(bundle, "quote_group")
    const bibleGroupRows = readGroups(bundle, "bible_group")
    const identityGroupRows = readGroups(bundle, "identity_group")
    const photoGroupRows = readGroups(bundle, "photo_group")
    const quoteRows = readQuotes(bundle)
    const bibleRows = readBible(bundle)
    const identityRows = readIdentities(bundle)
    const photoRows = readPhotos(bundle)
    const quoteGroupMap = freshIds(quoteGroupRows.map((row) => row.id))
    const bibleGroupMap = freshIds(bibleGroupRows.map((row) => row.id))
    const identityGroupMap = freshIds(identityGroupRows.map((row) => row.id))
    const photoGroupMap = freshIds(photoGroupRows.map((row) => row.id))
    const timestamp = now()
    db.transaction((tx) => {
      if (quoteGroupRows.length > 0) {
        tx.insert(quoteGroups)
          .values(quoteGroupRows.map((row) => ({ id: quoteGroupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (bibleGroupRows.length > 0) {
        tx.insert(bibleGroups)
          .values(bibleGroupRows.map((row) => ({ id: bibleGroupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (identityGroupRows.length > 0) {
        tx.insert(identityGroups)
          .values(identityGroupRows.map((row) => ({ id: identityGroupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (photoGroupRows.length > 0) {
        tx.insert(photoGroups)
          .values(photoGroupRows.map((row) => ({ id: photoGroupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (quoteRows.length > 0) {
        tx.insert(quotes)
          .values(
            quoteRows.map((row) => ({
              id: crypto.randomUUID(),
              groupId: remapGroupId(row.group_id, quoteGroupMap),
              body: row.body,
              attribution: row.attribution,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          )
          .run()
      }
      if (bibleRows.length > 0) {
        tx.insert(bibleTexts)
          .values(
            bibleRows.map((row) => ({
              id: crypto.randomUUID(),
              groupId: remapGroupId(row.group_id, bibleGroupMap),
              book: row.book,
              chapter: row.chapter,
              verseStart: row.verse_start,
              verseEnd: row.verse_end,
              body: row.body,
              translation: row.translation,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          )
          .run()
      }
      if (identityRows.length > 0) {
        tx.insert(identities)
          .values(
            identityRows.map((row) => ({
              id: crypto.randomUUID(),
              groupId: remapGroupId(row.group_id, identityGroupMap),
              kind: row.kind,
              name: row.name,
              text: row.text,
              mime: row.mime,
              widthPx: row.width_px,
              heightPx: row.height_px,
              thumbnail: row.thumbnail,
              bytes: row.bytes,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          )
          .run()
      }
      if (photoRows.length > 0) {
        tx.insert(photos)
          .values(
            photoRows.map((row) => ({
              id: crypto.randomUUID(),
              groupId: remapGroupId(row.group_id, photoGroupMap),
              name: row.name,
              mime: row.mime,
              widthPx: row.width_px,
              heightPx: row.height_px,
              thumbnail: row.thumbnail,
              bytes: row.bytes,
              createdAt: timestamp,
            })),
          )
          .run()
      }
    })
  } catch (error) {
    if (error instanceof PortableError) throw error
    throw new PortableError("Este archivo no es una biblioteca de Fagus")
  } finally {
    bundle.close()
    fs.unlinkSync(opened.filePath)
  }
}

function writeQuotes(bundle: Database.Database, groupId?: string) {
  const groups = bundle.prepare("INSERT INTO quote_group (id, name) VALUES (?, ?)")
  const groupRows = groupId
    ? db.select().from(quoteGroups).where(eq(quoteGroups.id, groupId)).all()
    : db.select().from(quoteGroups).all()
  for (const row of groupRows) groups.run(row.id, row.name)
  const items = bundle.prepare("INSERT INTO quote (id, group_id, body, attribution) VALUES (?, ?, ?, ?)")
  const itemRows = groupId ? db.select().from(quotes).where(eq(quotes.groupId, groupId)).all() : db.select().from(quotes).all()
  for (const row of itemRows) items.run(row.id, row.groupId, row.body, row.attribution)
}

function writeBible(bundle: Database.Database, groupId?: string) {
  const groups = bundle.prepare("INSERT INTO bible_group (id, name) VALUES (?, ?)")
  const groupRows = groupId
    ? db.select().from(bibleGroups).where(eq(bibleGroups.id, groupId)).all()
    : db.select().from(bibleGroups).all()
  for (const row of groupRows) groups.run(row.id, row.name)
  const items = bundle.prepare(
    "INSERT INTO bible_text (id, group_id, book, chapter, verse_start, verse_end, body, translation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
  const itemRows = groupId
    ? db.select().from(bibleTexts).where(eq(bibleTexts.groupId, groupId)).all()
    : db.select().from(bibleTexts).all()
  for (const row of itemRows) {
    items.run(row.id, row.groupId, row.book, row.chapter, row.verseStart, row.verseEnd, row.body, row.translation)
  }
}

function writeIdentities(bundle: Database.Database, groupId?: string) {
  const groups = bundle.prepare("INSERT INTO identity_group (id, name) VALUES (?, ?)")
  const groupRows = groupId
    ? db.select().from(identityGroups).where(eq(identityGroups.id, groupId)).all()
    : db.select().from(identityGroups).all()
  for (const row of groupRows) groups.run(row.id, row.name)
  const items = bundle.prepare(
    "INSERT INTO identity (id, group_id, kind, name, text, mime, width_px, height_px, thumbnail, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
  const itemRows = groupId
    ? db.select().from(identities).where(eq(identities.groupId, groupId)).all()
    : db.select().from(identities).all()
  for (const row of itemRows) {
    items.run(row.id, row.groupId, row.kind, row.name, row.text, row.mime, row.widthPx, row.heightPx, row.thumbnail, row.bytes)
  }
}

function writePhotos(bundle: Database.Database, groupId?: string) {
  const groups = bundle.prepare("INSERT INTO photo_group (id, name) VALUES (?, ?)")
  const groupRows = groupId
    ? db.select().from(photoGroups).where(eq(photoGroups.id, groupId)).all()
    : db.select().from(photoGroups).all()
  for (const row of groupRows) groups.run(row.id, row.name)
  const items = bundle.prepare(
    "INSERT INTO photo (id, group_id, name, mime, width_px, height_px, thumbnail, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
  const itemRows = groupId ? db.select().from(photos).where(eq(photos.groupId, groupId)).all() : db.select().from(photos).all()
  for (const row of itemRows) {
    items.run(row.id, row.groupId, row.name, row.mime, row.widthPx, row.heightPx, row.thumbnail, row.bytes)
  }
}

function librarySchema(): string {
  return `
    CREATE TABLE bundle_meta (version INTEGER NOT NULL, kind TEXT NOT NULL, scope TEXT);
    CREATE TABLE quote_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE quote (id TEXT PRIMARY KEY, group_id TEXT, body TEXT NOT NULL, attribution TEXT NOT NULL);
    CREATE TABLE bible_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE bible_text (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse_start INTEGER NOT NULL,
      verse_end INTEGER,
      body TEXT NOT NULL,
      translation TEXT NOT NULL
    );
    CREATE TABLE identity_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE identity (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      mime TEXT,
      width_px INTEGER,
      height_px INTEGER,
      thumbnail BLOB,
      bytes BLOB
    );
    CREATE TABLE photo_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE photo (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      width_px INTEGER NOT NULL,
      height_px INTEGER NOT NULL,
      thumbnail BLOB NOT NULL,
      bytes BLOB NOT NULL
    );
  `
}

function openBundle(bytes: Buffer, invalid: string): { bundle: Database.Database; filePath: string } {
  if (!bytes.subarray(0, 15).toString("utf8").startsWith("SQLite format 3")) {
    throw new PortableError(invalid)
  }
  const filePath = path.join(os.tmpdir(), `fagus-import-${crypto.randomUUID()}.fagus`)
  fs.writeFileSync(filePath, bytes)
  return { bundle: new Database(filePath, { readonly: true, fileMustExist: true }), filePath }
}

function readMeta(bundle: Database.Database): { version: number; kind: string; scope: string | null } {
  if (!tableExists(bundle, "bundle_meta")) throw new PortableError("Este archivo no es un paquete de Fagus")
  const row = bundle.prepare("SELECT version, kind FROM bundle_meta").get() as { version: number; kind: string } | undefined
  if (!row) throw new PortableError("Este archivo no es un paquete de Fagus")
  const scope = columnExists(bundle, "bundle_meta", "scope")
    ? (bundle.prepare("SELECT scope FROM bundle_meta").get() as { scope: string | null }).scope
    : null
  return { version: row.version, kind: row.kind, scope }
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case "all":
      return "la biblioteca entera"
    case "quotes":
      return "citas"
    case "bible":
      return "textos bíblicos"
    case "identities":
      return "identidad"
    case "photos":
      return "fotos"
    default:
      return "otra biblioteca"
  }
}

type GroupRow = { id: string; name: string }
type QuoteRow = { id: string; group_id: string | null; body: string; attribution: string }
type BibleRow = {
  id: string
  group_id: string | null
  book: string
  chapter: number
  verse_start: number
  verse_end: number | null
  body: string
  translation: string
}
type IdentityRow = {
  id: string
  group_id: string | null
  kind: string
  name: string
  text: string
  mime: string | null
  width_px: number | null
  height_px: number | null
  thumbnail: Buffer | null
  bytes: Buffer | null
}
type PhotoRow = {
  id: string
  group_id: string | null
  name: string
  mime: string
  width_px: number
  height_px: number
  thumbnail: Buffer
  bytes: Buffer
}

function readGroups(bundle: Database.Database, table: string): GroupRow[] {
  if (!tableExists(bundle, table)) return []
  return bundle.prepare(`SELECT id, name FROM ${table}`).all() as GroupRow[]
}

function readQuotes(bundle: Database.Database): QuoteRow[] {
  if (!tableExists(bundle, "quote")) return []
  if (!columnExists(bundle, "quote", "group_id")) {
    const rows = bundle.prepare("SELECT id, body, attribution FROM quote").all() as Array<Omit<QuoteRow, "group_id">>
    return rows.map((row) => ({ ...row, group_id: null }))
  }
  return bundle.prepare("SELECT id, group_id, body, attribution FROM quote").all() as QuoteRow[]
}

function readBible(bundle: Database.Database): BibleRow[] {
  if (!tableExists(bundle, "bible_text")) return []
  if (!columnExists(bundle, "bible_text", "group_id")) {
    const rows = bundle.prepare("SELECT id, book, chapter, verse_start, verse_end, body, translation FROM bible_text").all() as Array<
      Omit<BibleRow, "group_id">
    >
    return rows.map((row) => ({ ...row, group_id: null }))
  }
  return bundle
    .prepare("SELECT id, group_id, book, chapter, verse_start, verse_end, body, translation FROM bible_text")
    .all() as BibleRow[]
}

function readIdentities(bundle: Database.Database): IdentityRow[] {
  if (!tableExists(bundle, "identity")) return []
  if (!columnExists(bundle, "identity", "group_id")) {
    const rows = bundle
      .prepare("SELECT id, kind, name, text, mime, width_px, height_px, thumbnail, bytes FROM identity")
      .all() as Array<Omit<IdentityRow, "group_id">>
    return rows.map((row) => ({ ...row, group_id: null }))
  }
  return bundle
    .prepare("SELECT id, group_id, kind, name, text, mime, width_px, height_px, thumbnail, bytes FROM identity")
    .all() as IdentityRow[]
}

function readPhotos(bundle: Database.Database): PhotoRow[] {
  if (!tableExists(bundle, "photo")) return []
  if (!columnExists(bundle, "photo", "group_id")) {
    const rows = bundle
      .prepare("SELECT id, name, mime, width_px, height_px, thumbnail, bytes FROM photo")
      .all() as Array<Omit<PhotoRow, "group_id">>
    return rows.map((row) => ({ ...row, group_id: null }))
  }
  return bundle.prepare("SELECT id, group_id, name, mime, width_px, height_px, thumbnail, bytes FROM photo").all() as PhotoRow[]
}

function tableExists(bundle: Database.Database, name: string): boolean {
  const row = bundle.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) as
    | { ok: number }
    | undefined
  return Boolean(row)
}

function columnExists(bundle: Database.Database, table: string, column: string): boolean {
  const rows = bundle.pragma(`table_info(${table})`) as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}
