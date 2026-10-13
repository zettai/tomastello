import { z } from "zod";
import { isEmailLike } from "@/lib/text";

/** Same rules as `normalizeEmail` in auth/magic-link (route returns generic 400 on failure). */
function isMagicLinkEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return email.length <= 320 && isEmailLike(email);
}

const siteLinkSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  href: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
});

export const sitePutBodySchema = z.object({
  about: z.object({
    content: z.string().max(2000),
  }),
  photos: z
    .array(
      z.object({
        id: z.string().min(1),
        url: z.string().min(1),
      })
    )
    .optional(),
  links: z.array(siteLinkSchema).optional(),
  updatedAt: z.string().optional(),
});

export const linkCreateBodySchema = z.object({
  text: z.string().min(1),
  href: z.string().min(1),
  description: z.string().optional(),
});

export const linkDeleteQuerySchema = z.object({
  id: z.string().min(1),
});

export const linkIdParamSchema = z.object({
  id: z.string().min(1),
});

export const linkUpdateBodySchema = z
  .object({
    text: z.string().min(1).optional(),
    href: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .strict();

export const audioIdParamSchema = z.object({
  id: z.string().min(1),
});

export const audioUpdateBodySchema = z
  .object({
    title: z
      .string()
      .optional()
      .refine((value) => value === undefined || value.trim().length > 0),
  })
  .strict();

export const audioReorderBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const adminSecurityPostSchema = z.object({
  action: z.literal("unlock"),
});

export const magicLinkGetQuerySchema = z.object({
  token: z.string().nullable(),
});

export const magicLinkPostBodySchema = z.object({
  email: z.string().refine(isMagicLinkEmail),
  next: z.string().optional(),
  redirect: z.string().optional(),
});

export const imageDeleteQuerySchema = z.object({
  key: z.string().min(1),
});

export const imageMetadataUpdateBodySchema = z
  .object({
    id: z.string().min(1),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
    alt: z.string().optional(),
  })
  .strict();

export const imagePresignBodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number(),
});

export const imageCompleteBodySchema = z.object({
  key: z.string().min(1),
  originalName: z.string().optional(),
});

/** Accepts real `File` instances and test doubles with the same surface. */
function isUploadFile(value: unknown): value is File {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as {
    type?: unknown;
    size?: unknown;
    name?: unknown;
  };
  return (
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.name === "string"
  );
}

export const imageRelayUploadFormSchema = z.object({
  file: z.custom<File>((value) => isUploadFile(value), { message: "file required" }),
});

export const audioRelayUploadFormSchema = z.object({
  file: z.custom<File>((value) => isUploadFile(value), { message: "file required" }),
  title: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1)
  ),
});

export const audioMultipartInitBodySchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number(),
});

const multipartCompletePartSchema = z.object({
  partNumber: z.number().int().min(1),
  etag: z.string().min(1),
});

export const audioMultipartCompleteBodySchema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  parts: z.array(multipartCompletePartSchema).min(1),
  title: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number(),
});

const partNumberFromQuery = z
  .string()
  .min(1)
  .transform((value) => Number(value))
  .pipe(z.number());

export const multipartPartQuerySchema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  partNumber: partNumberFromQuery,
});

export const multipartPartPresignQuerySchema = multipartPartQuerySchema.extend({
  size: z
    .string()
    .min(1)
    .transform((value) => Number(value))
    .pipe(z.number()),
});

export const multipartAbortQuerySchema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
});
