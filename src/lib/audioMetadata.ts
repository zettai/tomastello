import { PutObjectCommand } from "@aws-sdk/client-s3";
import { SCALEWAY_BUCKET, scalewayClient } from "./api";
import { readJson, updateJson } from "./jsonStore";
import type { AudioMetadata } from "@/types/audio";

export type { AudioMetadata } from "@/types/audio";

const METADATA_FILE_KEY = "metadata/audios.json";

export async function getAudioMetadata(): Promise<AudioMetadata[]> {
  return (await readJson<AudioMetadata[]>(METADATA_FILE_KEY, [])).data;
}

export async function saveAudioMetadata(
  metadata: AudioMetadata[]
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: SCALEWAY_BUCKET,
    Key: METADATA_FILE_KEY,
    Body: JSON.stringify(metadata, null, 2),
    ContentType: "application/json",
  });

  await scalewayClient.send(command);
}

export async function addAudioMetadata(
  audioData: Omit<AudioMetadata, "id" | "uploadedAt" | "order">
): Promise<AudioMetadata> {
  const base = { ...audioData, id: Date.now().toString(), uploadedAt: new Date().toISOString() };
  let created: AudioMetadata = { ...base, order: 1 };
  await updateJson<AudioMetadata[]>(METADATA_FILE_KEY, [], (metadata) => {
    created = { ...base, order: metadata.length + 1 };
    return [...metadata, created];
  });
  return created;
}

export async function updateAudioMetadata(
  id: string,
  updates: Partial<AudioMetadata>
): Promise<AudioMetadata | null> {
  let updated: AudioMetadata | null = null;
  await updateJson<AudioMetadata[]>(METADATA_FILE_KEY, [], (metadata) => {
    const current = metadata.find((m) => m.id === id);
    updated = current ? { ...current, ...updates } : null;
    return current ? metadata.map((m) => (m.id === id ? { ...m, ...updates } : m)) : metadata;
  });
  return updated;
}

export async function deleteAudioMetadata(id: string): Promise<boolean> {
  let found = false;
  await updateJson<AudioMetadata[]>(METADATA_FILE_KEY, [], (metadata) => {
    found = metadata.some((m) => m.id === id);
    return found ? metadata.filter((m) => m.id !== id) : metadata;
  });
  return found;
}

export async function getAudioByFileName(
  fileName: string
): Promise<AudioMetadata | null> {
  const metadata = await getAudioMetadata();
  return metadata.find((m) => m.fileName === fileName) ?? null;
}

export async function reorderAudioMetadata(
  ids: string[]
): Promise<AudioMetadata[]> {
  return updateJson<AudioMetadata[]>(METADATA_FILE_KEY, [], (metadata) =>
    ids
      .map((id, index) => {
        const item = metadata.find((m) => m.id === id);
        if (!item) return null;
        return { ...item, order: index + 1 };
      })
      .filter((item): item is AudioMetadata => item !== null)
  );
}
