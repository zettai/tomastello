import { readJson, replaceJson, updateJson } from "./jsonStore";
import { LinkMetadata } from "@/types/link";

const METADATA_FILE_KEY = "metadata/links.json";

// Get all link metadata
export async function getLinkMetadata(): Promise<LinkMetadata[]> {
  return (await readJson<LinkMetadata[]>(METADATA_FILE_KEY, [])).data;
}

// Replace all link metadata (unconditional: last write wins; prefer the add/update/delete helpers)
export async function saveLinkMetadata(links: LinkMetadata[]): Promise<void> {
  await replaceJson(METADATA_FILE_KEY, links);
}

// Add new link metadata
export async function addLinkMetadata(
  linkData: Omit<LinkMetadata, "id" | "createdAt">
): Promise<LinkMetadata> {
  const newLink: LinkMetadata = {
    ...linkData,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  await updateJson<LinkMetadata[]>(METADATA_FILE_KEY, [], (links) => [...links, newLink]);
  return newLink;
}

// Update link metadata
export async function updateLinkMetadata(
  id: string,
  updates: Partial<LinkMetadata>
): Promise<LinkMetadata | null> {
  let updated: LinkMetadata | null = null;
  await updateJson<LinkMetadata[]>(METADATA_FILE_KEY, [], (links) => {
    const current = links.find((l) => l.id === id);
    updated = current ? { ...current, ...updates } : null;
    return current ? links.map((l) => (l.id === id ? { ...l, ...updates } : l)) : links;
  });
  return updated;
}

// Delete link metadata
export async function deleteLinkMetadata(id: string): Promise<boolean> {
  let found = false;
  await updateJson<LinkMetadata[]>(METADATA_FILE_KEY, [], (links) => {
    found = links.some((l) => l.id === id);
    return found ? links.filter((l) => l.id !== id) : links;
  });
  return found;
}
