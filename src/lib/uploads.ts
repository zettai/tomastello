import { SCALEWAY_BUCKET } from "./api";

/**
 * How uploaded bytes reach the bucket.
 * - `relay`: the browser sends files to our API routes, which forward them (current host).
 * - `presigned`: the API signs short-lived URLs and the browser sends files straight to the
 *   bucket. Needs bucket CORS (see docs/UPLOADS.md); required on hosts that cap request
 *   bodies, such as Netlify functions (6 MB).
 */
export type UploadMode = "relay" | "presigned";

type Env = Record<string, string | undefined>;

/** Presigned URLs expire after this many seconds. */
export const PRESIGN_EXPIRY_SECONDS = 300;

export const DEFAULT_CHUNK_SIZE_MB = 5;
/** S3 rejects non-final multipart parts under 5 MB. */
export const MIN_CHUNK_SIZE_MB = 5;
export const MAX_CHUNK_SIZE_MB = 64;

export const MAX_AUDIO_SIZE = 100 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 30 * 1024 * 1024;
/** One multipart part may never be larger than this. */
export const MAX_PART_SIZE = MAX_CHUNK_SIZE_MB * 2 * 1024 * 1024;
/** S3's limit on parts per multipart upload. */
export const MAX_PART_NUMBER = 10000;

export const AUDIO_MIME_TO_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  "audio/mpeg": [".mp3"],
  "audio/ogg": [".ogg"],
  "audio/flac": [".flac"],
  "audio/x-flac": [".flac"],
  "audio/wav": [".wav"],
  "audio/aac": [".aac", ".m4a"],
  "audio/webm": [".webm"],
};

export const AUDIO_MIME_TYPES: ReadonlySet<string> = new Set(Object.keys(AUDIO_MIME_TO_EXTENSIONS));

/** Image types accepted for direct (presigned) uploads. */
export const IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const KEY_PATTERNS = {
  audio: /^audio\/\d+-[A-Za-z0-9._-]+$/,
  images: /^images\/\d+-[A-Za-z0-9._-]+$/,
} as const;

export type UploadPrefix = keyof typeof KEY_PATTERNS;

/**
 * Reads UPLOAD_MODE. Presigned unless it is "relay": Netlify functions refuse request bodies
 * over 6 MB, so relayed uploads can't work there.
 */
export function getUploadMode(env: Env = process.env): UploadMode {
  return env.UPLOAD_MODE?.trim().toLowerCase() === "relay" ? "relay" : "presigned";
}

/**
 * Multipart chunk size in MB, from UPLOAD_CHUNK_SIZE_MB (runtime), clamped to what S3 and
 * our part-size cap allow. Served to the browser by /api/uploads/config.
 */
export function getChunkSizeMb(env: Env = process.env): number {
  const parsed = Number.parseInt(env.UPLOAD_CHUNK_SIZE_MB ?? "", 10);
  if (Number.isNaN(parsed)) return DEFAULT_CHUNK_SIZE_MB;
  return Math.min(MAX_CHUNK_SIZE_MB, Math.max(MIN_CHUNK_SIZE_MB, parsed));
}

/** Lower-case extension including the dot, or "" when there is none. */
export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

/** True when the file name's extension (if any) fits the audio MIME type. */
export function audioExtensionMatches(fileName: string, mimeType: string): boolean {
  const ext = getExtension(fileName);
  const allowed = AUDIO_MIME_TO_EXTENSIONS[mimeType] ?? [];
  return !ext || allowed.length === 0 || allowed.includes(ext);
}

/** The server always picks the key: `<prefix>/<timestamp>-<sanitised name>`. */
export function buildObjectKey(prefix: UploadPrefix, fileName: string, now: number = Date.now()): string {
  const sanitized = fileName.replaceAll(/[^a-zA-Z0-9.-]/g, "_").slice(-200) || "file";
  return `${prefix}/${now}-${sanitized}`;
}

/** True only for keys shaped like the ones buildObjectKey makes under that prefix. */
export function isUploadKey(prefix: UploadPrefix, key: unknown): key is string {
  return typeof key === "string" && key.length <= 300 && KEY_PATTERNS[prefix].test(key);
}

/** Public URL of an object (the bucket serves uploads publicly). */
export function publicObjectUrl(key: string, env: Env = process.env): string {
  return `https://${SCALEWAY_BUCKET}.s3.${env.SCW_DEFAULT_REGION}.scw.cloud/${key}`;
}
