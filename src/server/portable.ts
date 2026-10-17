import Database from "better-sqlite3"
import { eq } from "drizzle-orm"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseSideDocument, type SideDocument } from "../domain/document"
import { remapSide, selectionForDesigns, type IdMaps } from "../domain/portable"
import { db, now } from "./db"
import { bibleTexts, designs, identities, photoGroups, photos, projects, quotes } from "./schema"

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
  const groupRows = db.select().from(photoGroups).all()

  const sides = designRows.flatMap((row) => [parseStored(row.frontDocument), parseStored(row.backDocument)])
  const selection = selectionForDesigns(sides, {
    quotes: quoteRows,
    bibleTexts: bibleRows,
    photos: photoRows.map((photo) => ({ id: photo.id, groupId: photo.groupId })),
  })

  const filePath = path.join(os.tmpdir(), `fagus-${crypto.randomUUID()}.fagus`)
  const bundle = new Database(filePath)
  try {
    bundle.exec(`
      CREATE TABLE bundle_meta (version INTEGER NOT NULL, kind TEXT NOT NULL);
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
      CREATE TABLE quote (id TEXT PRIMARY KEY, body TEXT NOT NULL, attribution TEXT NOT NULL);
      CREATE TABLE bible_text (
        id TEXT PRIMARY KEY,
        book TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse_start INTEGER NOT NULL,
        verse_end INTEGER,
        body TEXT NOT NULL,
        translation TEXT NOT NULL
      );
      CREATE TABLE identity (
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
      const insertQuote = bundle.prepare("INSERT INTO quote (id, body, attribution) VALUES (?, ?, ?)")
      for (const row of quoteRows.filter((item) => selection.quoteIds.includes(item.id))) {
        insertQuote.run(row.id, row.body, row.attribution)
      }
      const insertBible = bundle.prepare(
        "INSERT INTO bible_text (id, book, chapter, verse_start, verse_end, body, translation) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      for (const row of bibleRows.filter((item) => selection.bibleTextIds.includes(item.id))) {
        insertBible.run(row.id, row.book, row.chapter, row.verseStart, row.verseEnd, row.body, row.translation)
      }
      const insertIdentity = bundle.prepare(
        "INSERT INTO identity (id, kind, name, text, mime, width_px, height_px, thumbnail, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      for (const row of identityRows.filter((item) => selection.identityIds.includes(item.id))) {
        insertIdentity.run(row.id, row.kind, row.name, row.text, row.mime, row.widthPx, row.heightPx, row.thumbnail, row.bytes)
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
    const meta = bundle.prepare("SELECT version, kind FROM bundle_meta").get() as { version: number; kind: string } | undefined
    if (!meta || meta.version !== FORMAT_VERSION || meta.kind !== "project") {
      throw new PortableError("Este archivo es de otra versión de Fagus")
    }
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
    const quoteRows = bundle.prepare("SELECT id, body, attribution FROM quote").all() as Array<{
      id: string
      body: string
      attribution: string
    }>
    const bibleRows = bundle
      .prepare("SELECT id, book, chapter, verse_start, verse_end, body, translation FROM bible_text")
      .all() as Array<{
      id: string
      book: string
      chapter: number
      verse_start: number
      verse_end: number | null
      body: string
      translation: string
    }>
    const identityRows = bundle
      .prepare("SELECT id, kind, name, text, mime, width_px, height_px, thumbnail, bytes FROM identity")
      .all() as Array<{
      id: string
      kind: string
      name: string
      text: string
      mime: string | null
      width_px: number | null
      height_px: number | null
      thumbnail: Buffer | null
      bytes: Buffer | null
    }>
    const groupRows = bundle.prepare("SELECT id, name FROM photo_group").all() as Array<{ id: string; name: string }>
    const photoRows = bundle
      .prepare("SELECT id, group_id, name, mime, width_px, height_px, thumbnail, bytes FROM photo")
      .all() as Array<{
      id: string
      group_id: string | null
      name: string
      mime: string
      width_px: number
      height_px: number
      thumbnail: Buffer
      bytes: Buffer
    }>

    const ids: IdMaps = {
      quotes: freshIds(quoteRows.map((row) => row.id)),
      bibleTexts: freshIds(bibleRows.map((row) => row.id)),
      identities: freshIds(identityRows.map((row) => row.id)),
      photos: freshIds(photoRows.map((row) => row.id)),
    }
    const groupMap = freshIds(groupRows.map((row) => row.id))
    const projectId = crypto.randomUUID()
    const timestamp = now()

    db.transaction((tx) => {
      tx.insert(projects).values({ id: projectId, name: project.name, createdAt: timestamp, updatedAt: timestamp }).run()
      if (quoteRows.length > 0) {
        tx.insert(quotes)
          .values(
            quoteRows.map((row) => ({
              id: ids.quotes.get(row.id) ?? row.id,
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
      if (groupRows.length > 0) {
        tx.insert(photoGroups)
          .values(groupRows.map((row) => ({ id: groupMap.get(row.id) ?? row.id, name: row.name, createdAt: timestamp })))
          .run()
      }
      if (photoRows.length > 0) {
        tx.insert(photos)
          .values(
            photoRows.map((row) => ({
              id: ids.photos.get(row.id) ?? row.id,
              groupId: row.group_id ? groupMap.get(row.group_id) ?? null : null,
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
