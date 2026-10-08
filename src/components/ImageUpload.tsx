"use client";

import { useState, useRef } from "react";
import { fetchUploadConfig, putToSignedUrl } from "@/lib/uploadClient";

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
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setUploading(true);

    try {
      const config = await fetchUploadConfig();
      const result = config.mode === "presigned" ? await uploadPresigned(file) : await uploadRelay(file);

      if (result.success) {
        onUploadSuccess?.(result);
      } else {
        alert(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
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
    // Drag leave handler - no action needed
  };

  const insetClass = adminMode ? "admin-inset" : "retro-inset";
  const textClass = adminMode ? "admin-text" : "text-foreground";
  const textSecondaryClass = adminMode ? "admin-text-secondary" : "text-foreground-secondary";
  const textTertiaryClass = adminMode ? "admin-text-secondary" : "text-foreground-tertiary";

  return (
    <div className="w-full max-w-md mx-auto">
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
                Drag and drop or click to select
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
        onChange={handleFileSelect}
        aria-label="Select image file"
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
