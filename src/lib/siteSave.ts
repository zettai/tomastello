import { readApiError } from "./readApiError";

export interface SiteEtags {
  siteEtag: string | null;
  linksEtag: string | null;
}

export interface SiteSavePayload {
  data: Record<string, unknown>;
  etags: SiteEtags;
}

/** GET /api/site and capture ETags for a later conditional PUT. */
export async function loadSiteForSave(): Promise<SiteSavePayload> {
  const res = await fetch("/api/site");
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to fetch site data"));
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    data,
    etags: {
      // Prefer X-Site-ETag: Netlify strips/rewrites standard ETag.
      siteEtag: res.headers.get("X-Site-ETag") ?? res.headers.get("ETag"),
      linksEtag: res.headers.get("X-Links-ETag"),
    },
  };
}

/** PUT /api/site with X-Site-If-Match / X-Links-If-Match from the matching GET. */
export async function putSiteWithEtags(
  body: unknown,
  etags: SiteEtags
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (etags.siteEtag) headers["X-Site-If-Match"] = etags.siteEtag;
  if (etags.linksEtag) headers["X-Links-If-Match"] = etags.linksEtag;
  return fetch("/api/site", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}
