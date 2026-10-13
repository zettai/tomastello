import { z } from "zod";
import {
  AUDIO_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  MAX_PART_NUMBER,
  MAX_PART_SIZE,
  isUploadKey,
} from "@/lib/uploads";

const imageMimeValues = Array.from(IMAGE_MIME_TYPES) as [string, ...string[]];
const audioMimeValues = Array.from(AUDIO_MIME_TYPES) as [string, ...string[]];

export const imageMimeSchema = z.enum(imageMimeValues);
export const audioMimeSchema = z.enum(audioMimeValues);

export const uploadImagesKeySchema = z
  .string()
  .refine((key) => isUploadKey("images", key));

export const uploadAudioKeySchema = z
  .string()
  .refine((key) => isUploadKey("audio", key));

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

/** Shape-only check; email format is validated in auth/magic-link. */
export const magicLinkPostBodySchema = z.object({
  email: z.string(),
  next: z.string().optional(),
  redirect: z.string().optional(),
});

export const imageDeleteQuerySchema = z.object({
  key: uploadImagesKeySchema,
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
  contentType: imageMimeSchema,
  size: z.number().int().min(1).max(MAX_IMAGE_SIZE),
});

export const imageCompleteBodySchema = z.object({
  key: uploadImagesKeySchema,
  originalName: z.string().optional(),
});

/** Accepts real `File` instances and test doubles with the same surface. */
function isUploadFile(value: unknown): value is File {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as {
    type?: unknown;
    size?: unknown;
    name?: unknown;
    arrayBuffer?: unknown;
  };
  return (
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.arrayBuffer === "function"
  );
}

export const imageRelayUploadFormSchema = z.object({
  file: z.custom<File>((value) => isUploadFile(value), { message: "file required" }),
});

export function validateRelayImageFile(file: File): boolean {
  return file.type.startsWith("image/") && file.size > 0 && file.size <= MAX_IMAGE_SIZE;
}

export const audioRelayUploadFormSchema = z.object({
  file: z.custom<File>((value) => isUploadFile(value), { message: "file required" }),
  title: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1)
  ),
});

export const audioMultipartInitBodySchema = z.object({
  fileName: z.string().min(1),
  mimeType: audioMimeSchema,
  size: z.number().nonnegative().max(MAX_AUDIO_SIZE),
});

const multipartCompletePartSchema = z.object({
  partNumber: z.number().int().min(1).max(MAX_PART_NUMBER),
  etag: z.string().min(1),
});

export const audioMultipartCompleteBodySchema = z.object({
  uploadId: z.string().min(1),
  key: uploadAudioKeySchema,
  parts: z.array(multipartCompletePartSchema).min(1),
  title: z.string().min(1),
  mimeType: audioMimeSchema,
  size: z.number().max(MAX_AUDIO_SIZE),
});

const partNumberFromQuery = z
  .string()
  .min(1)
  .transform((value) => Number(value))
  .pipe(z.number().int().min(1).max(MAX_PART_NUMBER));

export const multipartPartQuerySchema = z.object({
  uploadId: z.string().min(1),
  key: uploadAudioKeySchema,
  partNumber: partNumberFromQuery,
});

export const multipartPartPresignQuerySchema = multipartPartQuerySchema.extend({
  size: z
    .string()
    .min(1)
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(MAX_PART_SIZE)),
});

export const multipartAbortQuerySchema = z.object({
  uploadId: z.string().min(1),
  key: uploadAudioKeySchema,
});
