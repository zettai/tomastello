import { unstable_noStore as noStore } from "next/cache";
import { getLinkMetadata } from "@/lib/links";
import { getSiteData } from "@/lib/site";
import { toPublicLink } from "@/lib/publicView";
import type { PublicLink } from "@/lib/publicView";
import type { LinkMetadata } from "@/types/link";
import type { Photo, SiteData } from "@/types/site";

export type PublicHomeData = {
  aboutContent: string;
  links: PublicLink[];
  photos: Photo[];
  contentVersion: string;
};

/** Latest change timestamp across site doc and links (for CDN/admin live checks). */
export function computeContentVersion(site: SiteData, links: LinkMetadata[]): string {
  const stamps = [site.updatedAt, ...links.map((l) => l.createdAt)].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (stamps.length === 0) return "0";
  return stamps.sort().at(-1)!;
}

function netlifyOrigin(): string | null {
  const raw = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? process.env.TOMASTELLO_SITE_URL;
  return raw?.replace(/\/$/, "") ?? null;
}

/** On Netlify the page handler may not see bucket creds; the /api/site route does. */
async function getPublicHomeDataViaApi(origin: string): Promise<PublicHomeData | null> {
  try {
    const res = await fetch(`${origin}/api/site`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as SiteData & { links?: LinkMetadata[] };
    const rawLinks = data.links ?? [];
    const site: SiteData = {
      about: data.about,
      photos: data.photos ?? [],
      updatedAt: data.updatedAt,
    };
    return {
      aboutContent: site.about?.content ?? "",
      links: rawLinks.map(toPublicLink),
      photos: site.photos ?? [],
      contentVersion: computeContentVersion(site, rawLinks),
    };
  } catch {
    return null;
  }
}

export async function getPublicHomeData(): Promise<PublicHomeData> {
  noStore();
  const origin = netlifyOrigin();
  if (origin) {
    const viaApi = await getPublicHomeDataViaApi(origin);
    if (viaApi && viaApi.aboutContent.length > 0) return viaApi;
  }

  const site = await getSiteData();
  const rawLinks = await getLinkMetadata();
  return {
    aboutContent: site.about?.content ?? "",
    links: rawLinks.map(toPublicLink),
    photos: site.photos ?? [],
    contentVersion: computeContentVersion(site, rawLinks),
  };
}
