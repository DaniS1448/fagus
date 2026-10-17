import { z } from "zod"
import { sideDocumentSchema } from "../domain/document"

const nameSchema = z.string().trim().min(1, "Escribe un nombre").max(120, "El nombre es demasiado largo")

export const projectInputSchema = z.object({
  name: nameSchema,
})

export const designCreateSchema = z.object({
  name: nameSchema,
  widthMm: z.number().min(15).max(450).optional(),
  heightMm: z.number().min(15).max(450).optional(),
  sides: z.enum(["single", "double"]).optional(),
})

export const designPatchSchema = z.object({
  name: nameSchema.optional(),
  widthMm: z.number().min(15, "El ancho mínimo es 15 mm").max(450).optional(),
  heightMm: z.number().min(15, "El alto mínimo es 15 mm").max(450).optional(),
  sides: z.enum(["single", "double"]).optional(),
  front: sideDocumentSchema.optional(),
  back: sideDocumentSchema.optional(),
  seed: z.number().int().min(0).max(1_000_000_000).optional(),
})

const groupIdSchema = z.string().min(1).nullable().optional()

export const quoteInputSchema = z.object({
  body: z.string().trim().min(1, "Escribe la cita").max(4000),
  attribution: z.string().trim().max(160).default(""),
  groupId: groupIdSchema,
})

export const bibleInputSchema = z
  .object({
    book: z.string().trim().min(1, "Escribe el libro").max(80),
    chapter: z.number().int().positive("El capítulo tiene que ser un número"),
    verseStart: z.number().int().positive("El versículo tiene que ser un número"),
    verseEnd: z.number().int().positive().nullable().default(null),
    body: z.string().trim().min(1, "Escribe el texto").max(4000),
    translation: z.string().trim().max(80).default(""),
    groupId: groupIdSchema,
  })
  .refine((value) => value.verseEnd == null || value.verseEnd >= value.verseStart, {
    message: "El versículo final tiene que ser el mismo o posterior al inicial",
  })

const identityTitleSchema = z.string().trim().min(1, "Escribe el título").max(80)
export const identityLayoutSchema = z.enum(["stack", "row"])
export const identityTextShareSchema = z.number().int().min(20, "El título tiene que ocupar al menos un 20%").max(80, "El título puede ocupar como mucho un 80%")

export const identityWordmarkSchema = z.object({
  kind: z.literal("wordmark"),
  name: nameSchema,
  text: identityTitleSchema,
  groupId: groupIdSchema,
})

export const identityLockupSchema = z.object({
  kind: z.literal("lockup"),
  name: nameSchema,
  text: identityTitleSchema,
  layout: identityLayoutSchema,
  textShare: identityTextShareSchema,
  groupId: groupIdSchema,
})

export const identityLockupFileSchema = z.object({
  text: identityTitleSchema,
  layout: identityLayoutSchema,
  textShare: identityTextShareSchema,
})

export const identityLogoPatchSchema = z.object({
  name: nameSchema,
  groupId: groupIdSchema,
})

export const renameSchema = z.object({
  name: nameSchema,
})

export const photoPatchSchema = z
  .object({
    name: nameSchema.optional(),
    groupId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.groupId !== undefined, {
    message: "No hay cambios",
  })

export const itemBulkSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Elige al menos uno").max(200),
    op: z.enum(["delete", "move"]),
    groupId: z.string().min(1).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.op === "move" && value.groupId === undefined) {
      context.addIssue({ code: "custom", message: "Elige una agrupación" })
    }
  })

export const libraryScopeSchema = z.enum(["all", "quotes", "bible", "identities", "photos"])

export const photoBulkSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Elige al menos una foto").max(200),
    op: z.enum(["delete", "move"]),
    groupId: z.string().min(1).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.op === "move" && value.groupId === undefined) {
      context.addIssue({ code: "custom", message: "Elige una agrupación" })
    }
  })

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"])
