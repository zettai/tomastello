import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { sitePutBodySchema } from "@/lib/apiSchemas";
import { purgePublicPages } from "@/lib/cdn";
import { readSiteData, saveSiteData } from "@/lib/site";
import type { LinkMetadata } from "@/types/link";
import { verifyToken } from "@/lib/auth";
import { toPublicLink } from "@/lib/publicView";
import { readLinkMetadata, saveLinkMetadata } from "@/lib/links";
import { ConflictError } from "@/lib/jsonStore";
import { conflictResponse } from "@/lib/storeErrors";
import { parseJsonBody } from "@/lib/validateRequest";

function etagMismatch(
  expected: string | null,
  actual: string | null
): boolean {
  if (expected === null) return false;
  return expected !== actual;
}

// Link createdBy is an admin email: only admins see it (the admin page PUTs links back)
export async function GET(request: NextRequest) {
  try {
    const site = await readSiteData();
    const linksDoc = await readLinkMetadata();
    const token = request.cookies.get("auth-token")?.value;
    const headers = new Headers();
    // X-Site-ETag: Netlify strips/rewrites standard ETag / If-Match from the browser.
    if (site.etag) {
      headers.set("ETag", site.etag);
      headers.set("X-Site-ETag", site.etag);
    }
    if (linksDoc.etag) headers.set("X-Links-ETag", linksDoc.etag);

    if (token && (await verifyToken(token))) {
      return NextResponse.json(
        { ...site.data, links: linksDoc.data },
        { headers }
      );
    }
    return NextResponse.json(
      {
        ...site.data,
        links: linksDoc.data.map(toPublicLink),
      },
      { headers }
    );
  } catch (error) {
    console.error("Get site data error:", error);
    return NextResponse.json(
      { error: "Failed to get site data" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userPayload = await verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const parsed = await parseJsonBody(request, sitePutBodySchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const siteIfMatch =
      request.headers.get("X-Site-If-Match") ?? request.headers.get("If-Match");
    const linksIfMatch = request.headers.get("X-Links-If-Match");
    const { links, ...siteData } = data;

    // Check both ETags before writing anything (avoids half-saves)
    const currentSite = await readSiteData();
    const currentLinks = await readLinkMetadata();
    if (etagMismatch(siteIfMatch, currentSite.etag)) {
      return NextResponse.json(
        {
          error:
            "Someone else saved at the same moment. Reload and try again.",
        },
        { status: 409 }
      );
    }
    if (links !== undefined && etagMismatch(linksIfMatch, currentLinks.etag)) {
      return NextResponse.json(
        {
          error:
            "Someone else saved at the same moment. Reload and try again.",
        },
        { status: 409 }
      );
    }

    await saveSiteData(
      { ...siteData, photos: siteData.photos ?? [] },
      siteIfMatch === null ? undefined : siteIfMatch
    );

    if (links !== undefined) {
      try {
        await saveLinkMetadata(
          links as LinkMetadata[],
          linksIfMatch === null ? undefined : linksIfMatch
        );
      } catch (error) {
        if (error instanceof ConflictError) {
          return NextResponse.json(
            {
              error:
                "Site settings were saved, but links were not: someone else saved at the same moment. Reload and try again.",
            },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    revalidatePath("/");
    await purgePublicPages();

    return NextResponse.json(data);
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Update site data error:", error);
    return NextResponse.json(
      { error: "Failed to update site data" },
      { status: 500 }
    );
  }
}
