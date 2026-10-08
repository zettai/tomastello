import type { LinkMetadata } from "@/types/link";
import type { AudioMetadata } from "@/types/audio";

// What logged-out visitors see. An allowlist, so a new field stays private until added here.
// createdBy / uploadedBy are admin emails (also the login name) and stay out.

export type PublicLink = Omit<LinkMetadata, "createdBy">;
export type PublicAudio = Omit<AudioMetadata, "uploadedBy">;

export function toPublicLink(link: LinkMetadata): PublicLink {
  const { id, text, href, description, createdAt } = link;
  return { id, text, href, description, createdAt };
}

export function toPublicAudio(track: AudioMetadata): PublicAudio {
  const { id, title, fileName, url, size, mimeType, order, uploadedAt } = track;
  return { id, title, fileName, url, size, mimeType, order, uploadedAt };
}
