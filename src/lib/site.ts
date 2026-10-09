import { readJson, updateJson, writeJson, type Versioned } from "./jsonStore";
import { SiteData } from "@/types/site";

const SITE_DATA_FILE_KEY = "metadata/site.json";

const emptySite = (): SiteData => ({ about: { content: "" }, photos: [] });

/** Reads site.json with its ETag (null etag when the object does not exist). */
export async function readSiteData(): Promise<Versioned<SiteData>> {
  return readJson<SiteData>(SITE_DATA_FILE_KEY, emptySite());
}

export async function getSiteData(): Promise<SiteData> {
  return (await readSiteData()).data;
}

/**
 * Conditionally replaces the site document. Pass the ETag from the GET that loaded the
 * form (`If-Match`); null means the object must not exist yet. Throws ConflictError when
 * another save won the race (routes map that to 409).
 *
 * When `expectedEtag` is omitted, writes against the current ETag (narrow server-side race
 * only) so callers that do not carry a version still get conditional puts.
 */
export async function saveSiteData(
  data: SiteData,
  expectedEtag?: string | null
): Promise<void> {
  const stamped: SiteData = { ...data, updatedAt: new Date().toISOString() };
  const etag =
    expectedEtag === undefined ? (await readSiteData()).etag : expectedEtag;
  await writeJson(SITE_DATA_FILE_KEY, stamped, etag);
}

/** Removes a published photo by object key (`photos[].id`). Returns whether one was removed. */
export async function removeSitePhotoByKey(key: string): Promise<boolean> {
  let removed = false;
  await updateJson<SiteData>(SITE_DATA_FILE_KEY, emptySite(), (site) => {
    const photos = site.photos ?? [];
    const next = photos.filter((p) => p.id !== key);
    if (next.length === photos.length) return site;
    removed = true;
    return { ...site, photos: next, updatedAt: new Date().toISOString() };
  });
  return removed;
}
