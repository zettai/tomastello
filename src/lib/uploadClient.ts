/**
 * Browser helpers for uploads. Kept free of server imports so client components can use it.
 * The server decides the mode (UPLOAD_MODE) and chunk size (UPLOAD_CHUNK_SIZE_MB) at runtime
 * and serves them from /api/uploads/config.
 */

export type ClientUploadMode = "relay" | "presigned";

export interface UploadConfig {
  mode: ClientUploadMode;
  chunkSizeMb: number;
}

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = { mode: "relay", chunkSizeMb: 5 };

/** Reads the upload settings; falls back to relay mode with 5 MB chunks if they can't be read. */
export async function fetchUploadConfig(): Promise<UploadConfig> {
  try {
    const res = await fetch("/api/uploads/config");
    if (!res.ok) return DEFAULT_UPLOAD_CONFIG;
    const data = (await res.json()) as Partial<UploadConfig>;
    return {
      mode: data.mode === "presigned" ? "presigned" : "relay",
      chunkSizeMb:
        typeof data.chunkSizeMb === "number" && data.chunkSizeMb >= 5 ? data.chunkSizeMb : DEFAULT_UPLOAD_CONFIG.chunkSizeMb,
    };
  } catch {
    return DEFAULT_UPLOAD_CONFIG;
  }
}

/**
 * PUTs a body straight to a presigned bucket URL. Returns the ETag the bucket sent back
 * (needs `ExposeHeaders: ETag` in the bucket's CORS rules), "" if it sent none, or null
 * if the upload failed.
 */
export async function putToSignedUrl(
  url: string,
  body: Blob,
  headers: Record<string, string> = {}
): Promise<string | null> {
  const res = await fetch(url, { method: "PUT", body, headers });
  // Drain the (empty) body: an unread response is cancelled and logged as a failed request.
  await res.text().catch(() => "");
  if (!res.ok) return null;
  return res.headers.get("ETag") ?? "";
}
