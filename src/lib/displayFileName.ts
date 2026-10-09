/**
 * Prefer original upload name; otherwise strip `images/` / `audio/` and a leading
 * `timestamp-` storage prefix for admin UI labels only.
 */
export function displayFileName(
  storageKey: string,
  originalName?: string | null
): string {
  if (originalName && originalName.trim()) {
    return originalName.trim();
  }
  const base = storageKey.split("/").pop() || storageKey;
  return base.replace(/^\d+-/, "");
}
