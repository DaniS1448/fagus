import { eq, inArray } from "drizzle-orm"
import { Hono, type Context } from "hono"
import type { ZodError } from "zod"
import { emptySide, parseSideDocument } from "../domain/document"
import type { LibraryScope } from "../domain/portable"
import type { BibleText, Design, Identity, Photo, PhotoGroup, Project, Quote } from "../domain/models"
import { DEFAULT_HEIGHT_MM, DEFAULT_WIDTH_MM } from "../domain/units"
import { db, now } from "./db"
import { exportBundle, exportLibrary, importBundle, importLibrary, PortableError } from "./portable"
import { bibleGroups, bibleTexts, designs, identities, identityGroups, photoGroups, photos, projects, quoteGroups, quotes } from "./schema"
import {
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  bibleInputSchema,
  designCreateSchema,
  designPatchSchema,
  identityLogoPatchSchema,
  identityWordmarkSchema,
  itemBulkSchema,
  libraryScopeSchema,
  photoBulkSchema,
  photoPatchSchema,
  projectInputSchema,
  quoteInputSchema,
} from "./validators"

export function createApp(): Hono {
  const app = new Hono()

  app.get("/api/health", (c) => c.json({ ok: true }))

  app.get("/api/projects", (c) => {
    const rows = db.select().from(projects).all()
    return c.json(rows.map(toProject).sort((a, b) => b.updatedAt - a.updatedAt))
  })

  app.post("/api/projects", async (c) => {
    const parsed = projectInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    const timestamp = now()
    const row = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.insert(projects).values(row).run()
    return c.json(toProject(row), 201)
  })

  app.post("/api/projects/import", async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) return c.json({ error: "Elige un archivo de proyecto" }, 400)
    try {
      const projectId = importBundle(Buffer.from(await file.arrayBuffer()))
      return c.json({ projectId }, 201)
    } catch (error) {
      const message = error instanceof PortableError ? error.message : "No se pudo importar el proyecto"
      return c.json({ error: message }, 400)
    }
  })

  app.get("/api/projects/:id/export", (c) => {
    const file = exportBundle(c.req.param("id"))
    if (!file) return missing(c, "Proyecto")
    return fileResponse(file.bytes, file.filename)
  })

  app.get("/api/projects/:id", (c) => {
    const row = db.select().from(projects).where(eq(projects.id, c.req.param("id"))).get()
    if (!row) return missing(c, "Proyecto")
    return c.json(toProject(row))
  })

  app.patch("/api/projects/:id", async (c) => {
    const id = c.req.param("id")
    const current = db.select().from(projects).where(eq(projects.id, id)).get()
    if (!current) return missing(c, "Proyecto")
    const parsed = projectInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    const updatedAt = now()
    db.update(projects).set({ name: parsed.data.name, updatedAt }).where(eq(projects.id, id)).run()
    return c.json(toProject({ ...current, name: parsed.data.name, updatedAt }))
  })

  app.delete("/api/projects/:id", (c) => {
    const id = c.req.param("id")
    const result = db.delete(projects).where(eq(projects.id, id)).run()
    if (result.changes === 0) return missing(c, "Proyecto")
    return c.body(null, 204)
  })

  app.get("/api/projects/:id/designs", (c) => {
    const projectId = c.req.param("id")
    const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!project) return missing(c, "Proyecto")
    const rows = db.select().from(designs).where(eq(designs.projectId, projectId)).all()
    return c.json(rows.map(toDesign).sort((a, b) => b.updatedAt - a.updatedAt))
  })

  app.post("/api/projects/:id/designs", async (c) => {
    const projectId = c.req.param("id")
    const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!project) return missing(c, "Proyecto")
    const parsed = designCreateSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    const timestamp = now()
    const row = {
      id: crypto.randomUUID(),
      projectId,
      name: parsed.data.name,
      widthMm: parsed.data.widthMm ?? DEFAULT_WIDTH_MM,
      heightMm: parsed.data.heightMm ?? DEFAULT_HEIGHT_MM,
      sides: parsed.data.sides ?? "single",
      frontDocument: JSON.stringify(emptySide()),
      backDocument: JSON.stringify(emptySide()),
      seed: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.insert(designs).values(row).run()
    touchProject(projectId)
    return c.json(toDesign(row), 201)
  })

  app.get("/api/designs/:id", (c) => {
    const row = db.select().from(designs).where(eq(designs.id, c.req.param("id"))).get()
    if (!row) return missing(c, "Diseño")
    return c.json(toDesign(row))
  })

  app.patch("/api/designs/:id", async (c) => {
    const id = c.req.param("id")
    const current = db.select().from(designs).where(eq(designs.id, id)).get()
    if (!current) return missing(c, "Diseño")
    const parsed = designPatchSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    const updatedAt = now()
    const next = {
      name: parsed.data.name ?? current.name,
      widthMm: parsed.data.widthMm ?? current.widthMm,
      heightMm: parsed.data.heightMm ?? current.heightMm,
      sides: parsed.data.sides ?? current.sides,
      frontDocument: parsed.data.front ? JSON.stringify(parsed.data.front) : current.frontDocument,
      backDocument: parsed.data.back ? JSON.stringify(parsed.data.back) : current.backDocument,
      seed: parsed.data.seed ?? current.seed,
      updatedAt,
    }
    db.update(designs).set(next).where(eq(designs.id, id)).run()
    touchProject(current.projectId)
    return c.json(toDesign({ ...current, ...next }))
  })

  app.delete("/api/designs/:id", (c) => {
    const current = db.select().from(designs).where(eq(designs.id, c.req.param("id"))).get()
    if (!current) return missing(c, "Diseño")
    db.delete(designs).where(eq(designs.id, current.id)).run()
    touchProject(current.projectId)
    return c.body(null, 204)
  })

  app.post("/api/designs/:id/duplicate", (c) => {
    const current = db.select().from(designs).where(eq(designs.id, c.req.param("id"))).get()
    if (!current) return missing(c, "Diseño")
    const timestamp = now()
    const row = {
      ...current,
      id: crypto.randomUUID(),
      name: `${current.name} copia`.slice(0, 120),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.insert(designs).values(row).run()
    touchProject(current.projectId)
    return c.json(toDesign(row), 201)
  })

  app.get("/api/quotes", (c) => {
    const rows = db.select().from(quotes).all()
    return c.json(rows.map(toQuote).sort((a, b) => b.updatedAt - a.updatedAt))
  })

  app.post("/api/quotes", async (c) => {
    const parsed = quoteInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    if (parsed.data.groupId && !groupRow("quotes", parsed.data.groupId)) return missing(c, "Agrupación")
    const timestamp = now()
    const row = {
      id: crypto.randomUUID(),
      groupId: parsed.data.groupId ?? null,
      body: parsed.data.body,
      attribution: parsed.data.attribution,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.insert(quotes).values(row).run()
    return c.json(toQuote(row), 201)
  })

  app.post("/api/quotes/bulk", async (c) => bulkItems(c, "quotes"))

  app.patch("/api/quotes/:id", async (c) => {
    const current = db.select().from(quotes).where(eq(quotes.id, c.req.param("id"))).get()
    if (!current) return missing(c, "Cita")
    const parsed = quoteInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    if (parsed.data.groupId && !groupRow("quotes", parsed.data.groupId)) return missing(c, "Agrupación")
    const updatedAt = now()
    const next = {
      body: parsed.data.body,
      attribution: parsed.data.attribution,
      groupId: parsed.data.groupId === undefined ? current.groupId : parsed.data.groupId,
      updatedAt,
    }
    db.update(quotes).set(next).where(eq(quotes.id, current.id)).run()
    return c.json(toQuote({ ...current, ...next }))
  })

  app.delete("/api/quotes/:id", (c) => {
    const result = db.delete(quotes).where(eq(quotes.id, c.req.param("id"))).run()
    if (result.changes === 0) return missing(c, "Cita")
    return c.body(null, 204)
  })

  app.get("/api/bible-texts", (c) => {
    const rows = db.select().from(bibleTexts).all()
    return c.json(rows.map(toBible).sort((a, b) => b.updatedAt - a.updatedAt))
  })

  app.post("/api/bible-texts", async (c) => {
    const parsed = bibleInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    if (parsed.data.groupId && !groupRow("bible", parsed.data.groupId)) return missing(c, "Agrupación")
    const timestamp = now()
    const row = {
      id: crypto.randomUUID(),
      groupId: parsed.data.groupId ?? null,
      book: parsed.data.book,
      chapter: parsed.data.chapter,
      verseStart: parsed.data.verseStart,
      verseEnd: parsed.data.verseEnd,
      body: parsed.data.body,
      translation: parsed.data.translation,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.insert(bibleTexts).values(row).run()
    return c.json(toBible(row), 201)
  })

  app.post("/api/bible-texts/bulk", async (c) => bulkItems(c, "bible"))

  app.patch("/api/bible-texts/:id", async (c) => {
    const current = db.select().from(bibleTexts).where(eq(bibleTexts.id, c.req.param("id"))).get()
    if (!current) return missing(c, "Texto bíblico")
    const parsed = bibleInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    if (parsed.data.groupId && !groupRow("bible", parsed.data.groupId)) return missing(c, "Agrupación")
    const updatedAt = now()
    const next = {
      book: parsed.data.book,
      chapter: parsed.data.chapter,
      verseStart: parsed.data.verseStart,
      verseEnd: parsed.data.verseEnd,
      body: parsed.data.body,
      translation: parsed.data.translation,
      groupId: parsed.data.groupId === undefined ? current.groupId : parsed.data.groupId,
      updatedAt,
    }
    db.update(bibleTexts).set(next).where(eq(bibleTexts.id, current.id)).run()
    return c.json(toBible({ ...current, ...next }))
  })

  app.delete("/api/bible-texts/:id", (c) => {
    const result = db.delete(bibleTexts).where(eq(bibleTexts.id, c.req.param("id"))).run()
    if (result.changes === 0) return missing(c, "Texto bíblico")
    return c.body(null, 204)
  })

  app.get("/api/photos", (c) => {
    const rows = db
      .select({
        id: photos.id,
        groupId: photos.groupId,
        name: photos.name,
        mime: photos.mime,
        widthPx: photos.widthPx,
        heightPx: photos.heightPx,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .all()
    return c.json(rows.map(toPhoto).sort((a, b) => b.createdAt - a.createdAt))
  })

  app.post("/api/photos", async (c) => {
    const image = await readImageForm(c)
    if (image instanceof Response) return image
    if (image.groupId && !groupExists(image.groupId)) return missing(c, "Agrupación")
    const row = {
      id: crypto.randomUUID(),
      groupId: image.groupId,
      name: image.name,
      mime: image.mime,
      widthPx: image.widthPx,
      heightPx: image.heightPx,
      thumbnail: image.thumbnail,
      bytes: image.bytes,
      createdAt: now(),
    }
    db.insert(photos).values(row).run()
    return c.json(toPhoto(row), 201)
  })

  app.post("/api/photos/bulk", async (c) => {
    const parsed = photoBulkSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    const { ids, op, groupId } = parsed.data
    if (op === "delete") {
      db.delete(photos).where(inArray(photos.id, ids)).run()
      return c.body(null, 204)
    }
    if (groupId && !groupExists(groupId)) return missing(c, "Agrupación")
    db.update(photos)
      .set({ groupId: groupId ?? null })
      .where(inArray(photos.id, ids))
      .run()
    return c.body(null, 204)
  })

  app.patch("/api/photos/:id", async (c) => {
    const current = db.select({ id: photos.id }).from(photos).where(eq(photos.id, c.req.param("id"))).get()
    if (!current) return missing(c, "Foto")
    const parsed = photoPatchSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    if (parsed.data.groupId && !groupExists(parsed.data.groupId)) return missing(c, "Agrupación")
    db.update(photos).set(parsed.data).where(eq(photos.id, current.id)).run()
    const row = db
      .select({
        id: photos.id,
        groupId: photos.groupId,
        name: photos.name,
        mime: photos.mime,
        widthPx: photos.widthPx,
        heightPx: photos.heightPx,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .where(eq(photos.id, current.id))
      .get()
    if (!row) return missing(c, "Foto")
    return c.json(toPhoto(row))
  })

  app.delete("/api/photos/:id", (c) => {
    const result = db.delete(photos).where(eq(photos.id, c.req.param("id"))).run()
    if (result.changes === 0) return missing(c, "Foto")
    return c.body(null, 204)
  })

  app.get("/api/photos/:id/file", (c) => fileOf(c, "photo", "bytes"))
  app.get("/api/photos/:id/thumbnail", (c) => fileOf(c, "photo", "thumbnail"))

  app.get("/api/photo-groups", (c) => {
    const rows = db.select().from(photoGroups).all()
    return c.json(rows.map(toPhotoGroup).sort((a, b) => a.name.localeCompare(b.name, "es")))
  })

  app.post("/api/photo-groups", async (c) => {
    const parsed = projectInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    const row = { id: crypto.randomUUID(), name: parsed.data.name, createdAt: now() }
    db.insert(photoGroups).values(row).run()
    return c.json(toPhotoGroup(row), 201)
  })

  app.patch("/api/photo-groups/:id", async (c) => {
    const current = db.select().from(photoGroups).where(eq(photoGroups.id, c.req.param("id"))).get()
    if (!current) return missing(c, "Agrupación")
    const parsed = projectInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    db.update(photoGroups).set({ name: parsed.data.name }).where(eq(photoGroups.id, current.id)).run()
    return c.json(toPhotoGroup({ ...current, name: parsed.data.name }))
  })

  app.delete("/api/photo-groups/:id", (c) => {
    const id = c.req.param("id")
    const current = db.select().from(photoGroups).where(eq(photoGroups.id, id)).get()
    if (!current) return missing(c, "Agrupación")
    db.update(photos).set({ groupId: null }).where(eq(photos.groupId, id)).run()
    db.delete(photoGroups).where(eq(photoGroups.id, id)).run()
    return c.body(null, 204)
  })

  mountGroups(app, "/api/quote-groups", "quotes")
  mountGroups(app, "/api/bible-groups", "bible")
  mountGroups(app, "/api/identity-groups", "identities")

  app.get("/api/library/export", (c) => {
    const parsed = libraryScopeSchema.safeParse(c.req.query("scope"))
    if (!parsed.success) return c.json({ error: "Elige qué biblioteca exportar" }, 400)
    const scope = parsed.data
    const groupId = c.req.query("group")?.trim()
    if (!groupId) {
      const file = exportLibrary(scope)
      return fileResponse(file.bytes, file.filename)
    }
    if (scope === "all") return c.json({ error: "Elige una sección para exportar la agrupación" }, 400)
    const group = findExportGroup(scope, groupId)
    if (!group) return missing(c, "Agrupación")
    const file = exportLibrary(scope, group)
    return fileResponse(file.bytes, file.filename)
  })

  app.post("/api/library/import", async (c) => {
    const parsed = libraryScopeSchema.safeParse(c.req.query("scope"))
    if (!parsed.success) return c.json({ error: "Elige qué biblioteca importar" }, 400)
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) return c.json({ error: "Elige un archivo de biblioteca" }, 400)
    try {
      importLibrary(Buffer.from(await file.arrayBuffer()), parsed.data)
      return c.body(null, 204)
    } catch (error) {
      const message = error instanceof PortableError ? error.message : "No se pudo importar la biblioteca"
      return c.json({ error: message }, 400)
    }
  })

  app.post("/api/identities/bulk", async (c) => bulkItems(c, "identities"))

  app.get("/api/identities", (c) => {
    const rows = db
      .select({
        id: identities.id,
        groupId: identities.groupId,
        kind: identities.kind,
        name: identities.name,
        text: identities.text,
        mime: identities.mime,
        widthPx: identities.widthPx,
        heightPx: identities.heightPx,
        createdAt: identities.createdAt,
        updatedAt: identities.updatedAt,
      })
      .from(identities)
      .all()
    return c.json(rows.map(toIdentity).sort((a, b) => b.updatedAt - a.updatedAt))
  })

  app.post("/api/identities", async (c) => {
    const contentType = c.req.header("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const parsed = identityWordmarkSchema.safeParse(await readJson(c))
      if (!parsed.success) return invalid(c, parsed.error)
      if (parsed.data.groupId && !groupRow("identities", parsed.data.groupId)) return missing(c, "Agrupación")
      const timestamp = now()
      const row = {
        id: crypto.randomUUID(),
        groupId: parsed.data.groupId ?? null,
        kind: "wordmark" as const,
        name: parsed.data.name,
        text: parsed.data.text,
        mime: null,
        widthPx: null,
        heightPx: null,
        thumbnail: null,
        bytes: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      db.insert(identities).values(row).run()
      return c.json(toIdentity(row), 201)
    }

    const image = await readImageForm(c)
    if (image instanceof Response) return image
    if (image.groupId && !groupRow("identities", image.groupId)) return missing(c, "Agrupación")
    const timestamp = now()
    const row = {
      id: crypto.randomUUID(),
      groupId: image.groupId,
      kind: "logo" as const,
      name: image.name,
      text: "",
      mime: image.mime,
      widthPx: image.widthPx,
      heightPx: image.heightPx,
      thumbnail: image.thumbnail,
      bytes: image.bytes,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.insert(identities).values(row).run()
    return c.json(toIdentity(row), 201)
  })

  app.patch("/api/identities/:id", async (c) => {
    const current = db.select().from(identities).where(eq(identities.id, c.req.param("id"))).get()
    if (!current) return missing(c, "Identidad")
    const contentType = c.req.header("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const body = await readJson(c)
      if (current.kind === "wordmark") {
        const parsed = identityWordmarkSchema.safeParse(body)
        if (!parsed.success) return invalid(c, parsed.error)
        if (parsed.data.groupId && !groupRow("identities", parsed.data.groupId)) return missing(c, "Agrupación")
        const updatedAt = now()
        const next = {
          name: parsed.data.name,
          text: parsed.data.text,
          groupId: parsed.data.groupId === undefined ? current.groupId : parsed.data.groupId,
          updatedAt,
        }
        db.update(identities).set(next).where(eq(identities.id, current.id)).run()
        return c.json(toIdentity({ ...current, ...next }))
      }
      const parsed = identityLogoPatchSchema.safeParse(body)
      if (!parsed.success) return invalid(c, parsed.error)
      if (parsed.data.groupId && !groupRow("identities", parsed.data.groupId)) return missing(c, "Agrupación")
      const updatedAt = now()
      const next = {
        name: parsed.data.name,
        groupId: parsed.data.groupId === undefined ? current.groupId : parsed.data.groupId,
        updatedAt,
      }
      db.update(identities).set(next).where(eq(identities.id, current.id)).run()
      return c.json(toIdentity({ ...current, ...next }))
    }
    const image = await readImageForm(c)
    if (image instanceof Response) return image
    if (image.groupId && !groupRow("identities", image.groupId)) return missing(c, "Agrupación")
    const updatedAt = now()
    db.update(identities)
      .set({
        name: image.name,
        groupId: image.groupId,
        mime: image.mime,
        widthPx: image.widthPx,
        heightPx: image.heightPx,
        thumbnail: image.thumbnail,
        bytes: image.bytes,
        updatedAt,
      })
      .where(eq(identities.id, current.id))
      .run()
    return c.json(
      toIdentity({
        ...current,
        name: image.name,
        groupId: image.groupId,
        mime: image.mime,
        widthPx: image.widthPx,
        heightPx: image.heightPx,
        updatedAt,
      }),
    )
  })

  app.delete("/api/identities/:id", (c) => {
    const result = db.delete(identities).where(eq(identities.id, c.req.param("id"))).run()
    if (result.changes === 0) return missing(c, "Identidad")
    return c.body(null, 204)
  })

  app.get("/api/identities/:id/file", (c) => fileOf(c, "identity", "bytes"))
  app.get("/api/identities/:id/thumbnail", (c) => fileOf(c, "identity", "thumbnail"))

  app.all("/api/*", (c) => c.json({ error: "No encontrado" }, 404))
  return app
}

function toProject(row: { id: string; name: string; createdAt: number; updatedAt: number }): Project {
  return { id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

function toDesign(row: typeof designs.$inferSelect): Design {
  const sides = row.sides === "double" ? "double" : "single"
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    sides,
    front: parseDocument(row.frontDocument),
    back: parseDocument(row.backDocument),
    seed: row.seed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseDocument(value: string) {
  try {
    return parseSideDocument(JSON.parse(value))
  } catch {
    return emptySide()
  }
}

type LibraryKind = "quotes" | "bible" | "identities"

function mountGroups(app: Hono, base: string, kind: LibraryKind) {
  app.get(base, (c) => c.json(listGroups(kind).map(toPhotoGroup).sort((a, b) => a.name.localeCompare(b.name, "es"))))

  app.post(base, async (c) => {
    const parsed = projectInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    const row = { id: crypto.randomUUID(), name: parsed.data.name, createdAt: now() }
    insertGroup(kind, row)
    return c.json(toPhotoGroup(row), 201)
  })

  app.patch(`${base}/:id`, async (c) => {
    const current = groupRow(kind, c.req.param("id"))
    if (!current) return missing(c, "Agrupación")
    const parsed = projectInputSchema.safeParse(await readJson(c))
    if (!parsed.success) return invalid(c, parsed.error)
    renameGroup(kind, current.id, parsed.data.name)
    return c.json(toPhotoGroup({ ...current, name: parsed.data.name }))
  })

  app.delete(`${base}/:id`, (c) => {
    const current = groupRow(kind, c.req.param("id"))
    if (!current) return missing(c, "Agrupación")
    dissolveGroup(kind, current.id)
    return c.body(null, 204)
  })
}

async function bulkItems(c: Context, kind: LibraryKind): Promise<Response> {
  const parsed = itemBulkSchema.safeParse(await readJson(c))
  if (!parsed.success) return invalid(c, parsed.error)
  const ids = parsed.data.ids
  if (parsed.data.op === "delete") {
    deleteItems(kind, ids)
    return c.body(null, 204)
  }
  const groupId = parsed.data.groupId ?? null
  if (groupId && !groupRow(kind, groupId)) return missing(c, "Agrupación")
  moveItems(kind, ids, groupId)
  return c.body(null, 204)
}

function listGroups(kind: LibraryKind): Array<{ id: string; name: string; createdAt: number }> {
  switch (kind) {
    case "quotes":
      return db.select().from(quoteGroups).all()
    case "bible":
      return db.select().from(bibleGroups).all()
    case "identities":
      return db.select().from(identityGroups).all()
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function groupRow(kind: LibraryKind, id: string): { id: string; name: string; createdAt: number } | undefined {
  switch (kind) {
    case "quotes":
      return db.select().from(quoteGroups).where(eq(quoteGroups.id, id)).get()
    case "bible":
      return db.select().from(bibleGroups).where(eq(bibleGroups.id, id)).get()
    case "identities":
      return db.select().from(identityGroups).where(eq(identityGroups.id, id)).get()
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function insertGroup(kind: LibraryKind, row: { id: string; name: string; createdAt: number }) {
  switch (kind) {
    case "quotes":
      db.insert(quoteGroups).values(row).run()
      return
    case "bible":
      db.insert(bibleGroups).values(row).run()
      return
    case "identities":
      db.insert(identityGroups).values(row).run()
      return
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function renameGroup(kind: LibraryKind, id: string, name: string) {
  switch (kind) {
    case "quotes":
      db.update(quoteGroups).set({ name }).where(eq(quoteGroups.id, id)).run()
      return
    case "bible":
      db.update(bibleGroups).set({ name }).where(eq(bibleGroups.id, id)).run()
      return
    case "identities":
      db.update(identityGroups).set({ name }).where(eq(identityGroups.id, id)).run()
      return
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function dissolveGroup(kind: LibraryKind, id: string) {
  switch (kind) {
    case "quotes":
      db.update(quotes).set({ groupId: null }).where(eq(quotes.groupId, id)).run()
      db.delete(quoteGroups).where(eq(quoteGroups.id, id)).run()
      return
    case "bible":
      db.update(bibleTexts).set({ groupId: null }).where(eq(bibleTexts.groupId, id)).run()
      db.delete(bibleGroups).where(eq(bibleGroups.id, id)).run()
      return
    case "identities":
      db.update(identities).set({ groupId: null }).where(eq(identities.groupId, id)).run()
      db.delete(identityGroups).where(eq(identityGroups.id, id)).run()
      return
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function deleteItems(kind: LibraryKind, ids: string[]) {
  switch (kind) {
    case "quotes":
      db.delete(quotes).where(inArray(quotes.id, ids)).run()
      return
    case "bible":
      db.delete(bibleTexts).where(inArray(bibleTexts.id, ids)).run()
      return
    case "identities":
      db.delete(identities).where(inArray(identities.id, ids)).run()
      return
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function moveItems(kind: LibraryKind, ids: string[], groupId: string | null) {
  const updatedAt = now()
  switch (kind) {
    case "quotes":
      db.update(quotes).set({ groupId, updatedAt }).where(inArray(quotes.id, ids)).run()
      return
    case "bible":
      db.update(bibleTexts).set({ groupId, updatedAt }).where(inArray(bibleTexts.id, ids)).run()
      return
    case "identities":
      db.update(identities).set({ groupId, updatedAt }).where(inArray(identities.id, ids)).run()
      return
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function toQuote(row: typeof quotes.$inferSelect): Quote {
  return {
    id: row.id,
    groupId: row.groupId ?? null,
    body: row.body,
    attribution: row.attribution,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toBible(row: typeof bibleTexts.$inferSelect): BibleText {
  return {
    id: row.id,
    groupId: row.groupId ?? null,
    book: row.book,
    chapter: row.chapter,
    verseStart: row.verseStart,
    verseEnd: row.verseEnd,
    body: row.body,
    translation: row.translation,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toPhoto(row: {
  id: string
  groupId: string | null
  name: string
  mime: string
  widthPx: number
  heightPx: number
  createdAt: number
}): Photo {
  return { ...row, groupId: row.groupId ?? null }
}

function toPhotoGroup(row: { id: string; name: string; createdAt: number }): PhotoGroup {
  return row
}

function findExportGroup(scope: Exclude<LibraryScope, "all">, id: string): { id: string; name: string } | undefined {
  switch (scope) {
    case "quotes":
      return db.select({ id: quoteGroups.id, name: quoteGroups.name }).from(quoteGroups).where(eq(quoteGroups.id, id)).get()
    case "bible":
      return db.select({ id: bibleGroups.id, name: bibleGroups.name }).from(bibleGroups).where(eq(bibleGroups.id, id)).get()
    case "identities":
      return db
        .select({ id: identityGroups.id, name: identityGroups.name })
        .from(identityGroups)
        .where(eq(identityGroups.id, id))
        .get()
    case "photos":
      return db.select({ id: photoGroups.id, name: photoGroups.name }).from(photoGroups).where(eq(photoGroups.id, id)).get()
    default: {
      const unknown: never = scope
      return unknown
    }
  }
}

function groupExists(id: string): boolean {
  return Boolean(db.select({ id: photoGroups.id }).from(photoGroups).where(eq(photoGroups.id, id)).get())
}

function toIdentity(row: {
  id: string
  groupId?: string | null
  kind: string
  name: string
  text: string
  mime: string | null
  widthPx: number | null
  heightPx: number | null
  createdAt: number
  updatedAt: number
}): Identity {
  const kind = row.kind === "logo" ? "logo" : "wordmark"
  return { ...row, groupId: row.groupId ?? null, kind }
}

function touchProject(projectId: string) {
  db.update(projects).set({ updatedAt: now() }).where(eq(projects.id, projectId)).run()
}

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

function invalid(c: { json: (body: unknown, status?: number) => Response }, error: ZodError): Response {
  return c.json({ error: error.issues[0]?.message ?? "Datos no válidos" }, 400)
}

function missing(c: { json: (body: unknown, status?: number) => Response }, label: string): Response {
  return c.json({ error: `${label} no encontrado` }, 404)
}

function fileResponse(bytes: Buffer, filename: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
    },
  })
}

type ImagePayload = {
  name: string
  mime: string
  widthPx: number
  heightPx: number
  thumbnail: Buffer
  bytes: Buffer
  groupId: string | null
}

async function readImageForm(c: { req: HonoRequest; json: (body: unknown, status?: number) => Response }): Promise<ImagePayload | Response> {
  const body = await c.req.parseBody()
  const file = body.file
  const thumbnail = body.thumbnail
  if (!(file instanceof File) || !(thumbnail instanceof File)) {
    return c.json({ error: "Falta la imagen" }, 400)
  }
  if (!IMAGE_MIME.has(file.type)) {
    return c.json({ error: "Usa una imagen JPEG, PNG o WebP" }, 400)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: "La imagen supera los 20 MB" }, 413)
  }
  const widthPx = Number(body.widthPx)
  const heightPx = Number(body.heightPx)
  if (!Number.isInteger(widthPx) || !Number.isInteger(heightPx) || widthPx < 1 || heightPx < 1) {
    return c.json({ error: "No se pudieron leer las medidas de la imagen" }, 400)
  }
  const nameValue = typeof body.name === "string" ? body.name.trim() : ""
  const name = nameValue || file.name.replace(/\.[^.]+$/, "") || "Imagen"
  if (name.length > 120) return c.json({ error: "El nombre es demasiado largo" }, 400)
  const groupValue = typeof body.groupId === "string" ? body.groupId.trim() : ""
  return {
    name,
    mime: file.type,
    widthPx,
    heightPx,
    thumbnail: Buffer.from(await thumbnail.arrayBuffer()),
    bytes: Buffer.from(await file.arrayBuffer()),
    groupId: groupValue || null,
  }
}

type HonoRequest = {
  parseBody: () => Promise<Record<string, unknown>>
}

function fileOf(c: { req: { param: (name: string) => string }; json: (body: unknown, status?: number) => Response }, table: "photo" | "identity", column: "bytes" | "thumbnail") {
  if (table === "photo") {
    const row = db
      .select({
        mime: photos.mime,
        bytes: photos.bytes,
        thumbnail: photos.thumbnail,
      })
      .from(photos)
      .where(eq(photos.id, c.req.param("id")))
      .get()
    if (!row) return missing(c, "Foto")
    const payload = column === "bytes" ? row.bytes : row.thumbnail
    const mime = column === "thumbnail" ? "image/jpeg" : row.mime
    return new Response(new Uint8Array(payload), {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
    })
  }

  const row = db
    .select({
      mime: identities.mime,
      bytes: identities.bytes,
      thumbnail: identities.thumbnail,
    })
    .from(identities)
    .where(eq(identities.id, c.req.param("id")))
    .get()
  if (!row || !row.bytes || !row.thumbnail || !row.mime) return missing(c, "Logo")
  const payload = column === "bytes" ? row.bytes : row.thumbnail
  const mime = column === "thumbnail" ? "image/jpeg" : row.mime
  return new Response(new Uint8Array(payload), {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
  })
}
