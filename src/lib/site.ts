import { readJson, replaceJson } from "./jsonStore";
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
