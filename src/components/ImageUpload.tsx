"use client";

import { useState, useRef } from "react";
import { fetchUploadConfig, putToSignedUrl } from "@/lib/uploadClient";
import { useOptionalAdminToast } from "@/components/AdminToast";
import { mapWithConcurrency } from "@/lib/uploadQueue";

interface UploadResponse {
  success: boolean;
  fileName?: string;
  url?: string;
  size?: number;
  type?: string;
  error?: string;
}

interface ImageUploadProps {
  readonly onUploadSuccess?: (response: UploadResponse) => void;
  readonly adminMode?: boolean;
}

const UPLOAD_CONCURRENCY = 2;

async function uploadRelay(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/images/upload", { method: "POST", body: formData });
  return response.json();
}

/** Presigned mode: get a signed URL, PUT the file straight to the bucket, then register it. */
async function uploadPresigned(file: File): Promise<UploadResponse> {
  const signRes = await fetch("/api/images/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });
  const signed = (await signRes.json()) as { url?: string; key?: string; headers?: Record<string, string>; error?: string };
  if (!signRes.ok || !signed.url || !signed.key) {
    return { success: false, error: signed.error ?? "Upload failed" };
  }

  const etag = await putToSignedUrl(signed.url, file, signed.headers);
  if (etag === null) {
    return { success: false, error: "Upload to storage failed" };
  }

  const completeRes = await fetch("/api/images/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: signed.key, originalName: file.name }),
  });
  return completeRes.json();
}

export default function ImageUpload({ onUploadSuccess, adminMode = false }: ImageUploadProps) {
  const toast = useOptionalAdminToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const notifyError = (message: string) => {
    if (toast) {
      toast.showError(message);
      return;
    }
    alert(message);
  };

  const handleFilesUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const rejected = files.filter((f) => !f.type.startsWith("image/"));
    const accepted = files.filter((f) => f.type.startsWith("image/"));

    for (const bad of rejected) {
      notifyError(`${bad.name}: Please select an image file`);
    }
    if (accepted.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: accepted.length });

    try {
      const config = await fetchUploadConfig();
      let done = 0;
      await mapWithConcurrency(accepted, UPLOAD_CONCURRENCY, async (file) => {
        setProgress({ done, total: accepted.length, current: file.name });
        try {
          const result =
            config.mode === "presigned"
              ? await uploadPresigned(file)
              : await uploadRelay(file);
          if (result.success) {
            onUploadSuccess?.(result);
          } else {
            notifyError(`${file.name}: ${result.error || "Upload failed"}`);
          }
        } catch (error) {
          console.error("Upload error:", error);
          notifyError(`${file.name}: Upload failed`);
        } finally {
          done += 1;
          setProgress({ done, total: accepted.length, current: file.name });
        }
        return null;
      });
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (list && list.length > 0) {
      void handleFilesUpload(list);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const list = event.dataTransfer.files;
    if (list && list.length > 0) {
      void handleFilesUpload(list);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDragLeave = () => {
    // Drag leave handler - no action needed
  };

  const insetClass = adminMode ? "admin-inset" : "retro-inset";
  const textClass = adminMode ? "admin-text" : "text-foreground";
  const textSecondaryClass = adminMode ? "admin-text-secondary" : "text-foreground-secondary";
  const textTertiaryClass = adminMode ? "admin-text-secondary" : "text-foreground-tertiary";

  return (
    <div className="w-full max-w-md mx-auto space-y-2">
      <button
        type="button"
        className={`${insetClass} w-full p-8 text-center transition-all ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        aria-label="Upload image"
      >
        {uploading ? (
          <div className="space-y-3">
            <p className={`${textClass} text-lg`}>[ UPLOADING... ]</p>
            {progress && (
              <p className={`${textSecondaryClass} text-sm`}>
                {progress.done}/{progress.total}
                {progress.current ? ` · ${progress.current}` : ""}
              </p>
            )}
            <p className={`${textSecondaryClass} text-sm`}>PLEASE WAIT</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`${textClass} text-4xl`}>▲</div>
            <div>
              <p className={`text-lg font-bold ${textClass}`}>
                &gt; UPLOAD IMAGE
              </p>
              <p className={`text-sm ${textSecondaryClass}`}>
                Drag and drop or click to select (multiple OK)
              </p>
              <p className={`text-xs ${textTertiaryClass} mt-2`}>
                Max 30MB • JPG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        data-image
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        aria-label="Select image file"
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
