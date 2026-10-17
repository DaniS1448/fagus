import { blob, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export const designs = sqliteTable("designs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  widthMm: real("width_mm").notNull(),
  heightMm: real("height_mm").notNull(),
  sides: text("sides").notNull(),
  frontDocument: text("front_document").notNull(),
  backDocument: text("back_document").notNull(),
  seed: integer("seed").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export const photoGroups = sqliteTable("photo_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => photoGroups.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  widthPx: integer("width_px").notNull(),
  heightPx: integer("height_px").notNull(),
  thumbnail: blob("thumbnail", { mode: "buffer" }).notNull(),
  bytes: blob("bytes", { mode: "buffer" }).notNull(),
  createdAt: integer("created_at").notNull(),
})

export const quoteGroups = sqliteTable("quote_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => quoteGroups.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  attribution: text("attribution").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export const bibleGroups = sqliteTable("bible_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const bibleTexts = sqliteTable("bible_texts", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => bibleGroups.id, { onDelete: "set null" }),
  book: text("book").notNull(),
  chapter: integer("chapter").notNull(),
  verseStart: integer("verse_start").notNull(),
  verseEnd: integer("verse_end"),
  body: text("body").notNull(),
  translation: text("translation").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export const identityGroups = sqliteTable("identity_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const identities = sqliteTable("identities", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => identityGroups.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  layout: text("layout"),
  textShare: integer("text_share"),
  name: text("name").notNull(),
  text: text("text").notNull(),
  mime: text("mime"),
  widthPx: integer("width_px"),
  heightPx: integer("height_px"),
  thumbnail: blob("thumbnail", { mode: "buffer" }),
  bytes: blob("bytes", { mode: "buffer" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})
