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
      siteEtag: res.headers.get("ETag"),
      linksEtag: res.headers.get("X-Links-ETag"),
    },
  };
}

/** PUT /api/site with If-Match / X-Links-If-Match from the matching GET. */
export async function putSiteWithEtags(
  body: unknown,
  etags: SiteEtags
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (etags.siteEtag) headers["If-Match"] = etags.siteEtag;
  if (etags.linksEtag) headers["X-Links-If-Match"] = etags.linksEtag;
  return fetch("/api/site", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}
