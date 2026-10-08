import { PutObjectCommand } from "@aws-sdk/client-s3";
import { SCALEWAY_BUCKET, scalewayClient } from "./api";
import { readJson, updateJson } from "./jsonStore";

export interface ImageMetadata {
  id: string;
  fileName: string;
  originalName: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
  tags?: string[];
  description?: string;
  alt?: string;
}

const METADATA_FILE_KEY = "metadata/images.json";

// Get all image metadata
export async function getImageMetadata(): Promise<ImageMetadata[]> {
  return (await readJson<ImageMetadata[]>(METADATA_FILE_KEY, [])).data;
}

// Replace all image metadata (unconditional: last write wins; prefer the helpers below)
export async function saveImageMetadata(
  metadata: ImageMetadata[]
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: SCALEWAY_BUCKET,
    Key: METADATA_FILE_KEY,
    Body: JSON.stringify(metadata, null, 2),
    ContentType: "application/json",
  });

  await scalewayClient.send(command);
}

// Add new image metadata
export async function addImageMetadata(
  imageData: Omit<ImageMetadata, "id" | "uploadedAt">
): Promise<ImageMetadata> {
  const newMetadata: ImageMetadata = {
    ...imageData,
    id: Date.now().toString(),
    uploadedAt: new Date().toISOString(),
  };
  await updateJson<ImageMetadata[]>(METADATA_FILE_KEY, [], (metadata) => [...metadata, newMetadata]);
  return newMetadata;
}

// Update image metadata
export async function updateImageMetadata(
  id: string,
  updates: Partial<ImageMetadata>
): Promise<ImageMetadata | null> {
  let updated: ImageMetadata | null = null;
  await updateJson<ImageMetadata[]>(METADATA_FILE_KEY, [], (metadata) => {
    const current = metadata.find((m) => m.id === id);
    updated = current ? { ...current, ...updates } : null;
    return current ? metadata.map((m) => (m.id === id ? { ...m, ...updates } : m)) : metadata;
  });
  return updated;
}

// Delete image metadata
export async function deleteImageMetadata(id: string): Promise<boolean> {
  let found = false;
  await updateJson<ImageMetadata[]>(METADATA_FILE_KEY, [], (metadata) => {
    found = metadata.some((m) => m.id === id);
    return found ? metadata.filter((m) => m.id !== id) : metadata;
  });
  return found;
}

// Get metadata by filename
export async function getMetadataByFileName(
  fileName: string
): Promise<ImageMetadata | null> {
  const metadata = await getImageMetadata();
  return metadata.find((m) => m.fileName === fileName) || null;
}
