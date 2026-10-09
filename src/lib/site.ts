import { readJson, replaceJson, updateJson } from "./jsonStore";
import { SiteData } from "@/types/site";

const SITE_DATA_FILE_KEY = "metadata/site.json";

export async function getSiteData(): Promise<SiteData> {
  return (await readJson<SiteData>(SITE_DATA_FILE_KEY, { about: { content: "" }, photos: [] })).data;
}

/**
 * Replaces the site document. Unconditional on purpose: PUT /api/site sends the whole state from
 * the admin page, so the last save wins (see docs/NETLIFY.md, "Concurrent saves").
 */
export async function saveSiteData(data: SiteData): Promise<void> {
  const stamped: SiteData = { ...data, updatedAt: new Date().toISOString() };
  await replaceJson(SITE_DATA_FILE_KEY, stamped);
}

const emptySite = (): SiteData => ({ about: { content: "" }, photos: [] });

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
