"use client";

import { useState, useRef } from "react";
import { fetchUploadConfig, putToSignedUrl, type UploadConfig } from "@/lib/uploadClient";

interface AudioUploadProps {
  readonly onUploadSuccess?: () => void;
  readonly adminMode?: boolean;
}

const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const MIN_PART_SIZE = 5 * 1024 * 1024; // Scaleway requires ≥5 MB per non-final part
const MAX_RETRIES = 3;

type UploadResult = { success: boolean; error?: string };
type ProgressFn = (current: number, total: number, retryMsg?: string) => void;
/** Sends one part and returns its ETag, or null on failure. */
type PartSender = (chunk: Blob, partNumber: number) => Promise<string | null>;

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[\s.\-_]+/, "")
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

async function uploadSingleFile(file: File, title: string): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);

  const response = await fetch("/api/audio/upload", { method: "POST", body: formData });
  const result = await response.json() as { success?: boolean; error?: string };
  return { success: !!result.success, error: result.error };
}

function partUrl(uploadId: string, key: string, partNumber: number): string {
  return `/api/audio/upload/multipart/part?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`;
}

/** Relay mode: the part goes through our API, which forwards it to the bucket. */
function relayPartSender(uploadId: string, key: string): PartSender {
  return async (chunk, partNumber) => {
    const res = await fetch(partUrl(uploadId, key, partNumber), { method: "PUT", body: chunk });
    if (!res.ok) return null;
    const data = await res.json() as { etag?: string };
    return data.etag ?? null;
  };
}

/** Presigned mode: ask the API to sign the part, then PUT it straight to the bucket. */
function presignedPartSender(uploadId: string, key: string): PartSender {
  return async (chunk, partNumber) => {
    const signRes = await fetch(`${partUrl(uploadId, key, partNumber)}&size=${chunk.size}`);
    if (!signRes.ok) return null;
    const { url } = await signRes.json() as { url?: string };
    if (!url) return null;
    // An empty ETag means the bucket's CORS rules don't expose it: treat as a failure.
    return (await putToSignedUrl(url, chunk)) || null;
  };
}

async function sendWithRetries(
  send: PartSender,
  chunk: Blob,
  partNumber: number,
  totalParts: number,
  onProgress: ProgressFn
): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      onProgress(partNumber, totalParts, `Retrying part ${partNumber} (${attempt}/${MAX_RETRIES})...`);
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
    try {
      const etag = await send(chunk, partNumber);
      if (etag) return etag;
    } catch {
      // retry
    }
  }
  return null;
}

async function abortMultipart(uploadId: string, key: string): Promise<void> {
  await fetch(
    `/api/audio/upload/multipart/abort?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}`,
    { method: "DELETE" }
  ).catch(() => undefined);
}

/**
 * Number of parts for a file. If the last chunk would be < MIN_PART_SIZE, it is merged into
 * the previous one: S3 rejects non-final parts under 5 MB, but the last part can be any size.
 */
function countParts(fileSize: number, chunkSize: number): number {
  const rawParts = Math.ceil(fileSize / chunkSize);
  const lastChunkSize = fileSize - (rawParts - 1) * chunkSize;
  return rawParts > 1 && lastChunkSize < MIN_PART_SIZE ? rawParts - 1 : rawParts;
}

async function uploadMultipart(
  file: File,
  title: string,
  config: UploadConfig,
  onProgress: ProgressFn
): Promise<UploadResult> {
  const initRes = await fetch("/api/audio/upload/multipart/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
  });
  const initData = await initRes.json() as { uploadId?: string; key?: string; error?: string };
  if (!initRes.ok || !initData.uploadId || !initData.key) {
    return { success: false, error: initData.error ?? "Failed to initiate upload" };
  }

  const { uploadId, key } = initData;
  const chunkSize = config.chunkSizeMb * 1024 * 1024;
  const totalParts = countParts(file.size, chunkSize);
  const send = config.mode === "presigned" ? presignedPartSender(uploadId, key) : relayPartSender(uploadId, key);
  const parts: { partNumber: number; etag: string }[] = [];

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * chunkSize;
      const end = partNumber === totalParts ? file.size : Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const etag = await sendWithRetries(send, chunk, partNumber, totalParts, onProgress);
      if (!etag) {
        await abortMultipart(uploadId, key);
        return { success: false, error: `Failed to upload part ${partNumber} after ${MAX_RETRIES} attempts` };
      }

      parts.push({ partNumber, etag });
      onProgress(partNumber, totalParts);
    }

    const completeRes = await fetch("/api/audio/upload/multipart/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId, key, parts, title, mimeType: file.type, size: file.size }),
    });
    const completeData = await completeRes.json() as { success?: boolean; error?: string };
    return { success: !!completeData.success, error: completeData.error };
  } catch (err) {
    await abortMultipart(uploadId, key);
    return { success: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
}

export default function AudioUpload({
  onUploadSuccess,
  adminMode = false,
}: AudioUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [retryMessage, setRetryMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setUploadError("");
    setRetryMessage("");
    setProgress(null);
    setUploading(true);

    const title = titleFromFilename(file.name);

    try {
      let result: UploadResult;
      const config = await fetchUploadConfig();

      if (file.size === 0) {
        result = { success: false, error: "File is empty" };
      } else if (config.mode === "presigned" || file.size >= MULTIPART_THRESHOLD) {
        // Presigned mode always goes direct to the bucket, so small files use one part.
        result = await uploadMultipart(file, title, config, (current, total, retryMsg) => {
          setProgress({ current, total });
          setRetryMessage(retryMsg ?? "");
        });
      } else {
        result = await uploadSingleFile(file, title);
      }

      if (result.success) {
        setUploadError("");
        onUploadSuccess?.();
      } else {
        setUploadError(result.error ?? "Upload failed");
      }
    } catch (error) {
      console.error("Audio upload error:", error);
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      setProgress(null);
      setRetryMessage("");
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDragLeave = () => {
    // Drag leave — no action needed
  };

  const insetClass = adminMode ? "admin-inset" : "retro-inset";
  const textClass = adminMode ? "admin-text" : "text-foreground";
  const textSecondaryClass = adminMode
    ? "admin-text-secondary"
    : "text-foreground-secondary";
  const textTertiaryClass = adminMode
    ? "admin-text-secondary"
    : "text-foreground-tertiary";

  const progressPercent =
    progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {uploadError && (
        <p className="text-xs text-red-500">{uploadError}</p>
      )}

      <button
        type="button"
        className={`${insetClass} w-full p-8 text-center transition-all ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        aria-label="Upload audio"
      >
        {uploading ? (
          <div className="space-y-3">
            <p className={`${textClass} text-lg`}>[ UPLOADING... ]</p>
            {progress ? (
              <>
                <p className={`${textSecondaryClass} text-sm`}>
                  Part {progress.current} of {progress.total} &middot; {progressPercent}%
                </p>
                <div className="w-full bg-gray-700 h-1 rounded">
                  <div
                    className="bg-current h-1 rounded transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {retryMessage && (
                  <p className={`${textSecondaryClass} text-xs`}>{retryMessage}</p>
                )}
              </>
            ) : (
              <p className={`${textSecondaryClass} text-sm`}>PLEASE WAIT</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`${textClass} text-4xl`}>▲</div>
            <div>
              <p className={`text-lg font-bold ${textClass}`}>
                &gt; UPLOAD AUDIO
              </p>
              <p className={`text-sm ${textSecondaryClass}`}>
                Drag and drop or click to select
              </p>
              <p className={`text-xs ${textTertiaryClass} mt-2`}>
                Max 100MB per file &bull; MP3, OGG, FLAC, WAV, AAC, WebM
              </p>
            </div>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        data-audio
        accept=".mp3,.ogg,.flac,.wav,.aac,.m4a,.webm"
        onChange={handleFileSelect}
        aria-label="Select audio file"
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
