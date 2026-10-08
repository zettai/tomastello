import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { purgePublicPages } from "@/lib/cdn";
import { getSiteData, saveSiteData } from "@/lib/site";
import { verifyToken } from "@/lib/auth";
import { toPublicLink } from "@/lib/publicView";
import { getLinkMetadata, saveLinkMetadata } from "@/lib/links";

// Helper function to validate about content
function validateAboutContent(about: unknown): string | null {
  if (about && typeof about === "object" && "content" in about) {
    const content = (about as { content: unknown }).content;
    if (typeof content === "string" && content.length > 2000) {
      return "About content must be 2000 characters or less";
    }
  }
  return null;
}

// Helper function to validate photos array
function validatePhotos(photos: unknown): string | null {
  if (!photos) return null;

  if (!Array.isArray(photos)) {
    return "Photos must be an array";
  }

  for (const photo of photos) {
    if (!photo.id || !photo.url) {
      return "Each photo must have id and url";
    }
  }
  return null;
}

// Helper function to validate links array
function validateLinks(links: unknown): string | null {
  if (!links) return null;

  if (!Array.isArray(links)) {
    return "Links must be an array";
  }

  for (const link of links) {
    if (!link.text || !link.href) {
      return "Each link must have text and href";
    }
    if (typeof link.text !== "string" || typeof link.href !== "string") {
      return "Link text and href must be strings";
    }
  }
  return null;
}

// Link createdBy is an admin email: only admins see it (the admin page PUTs links back)
export async function GET(request: NextRequest) {
  try {
    const data = await getSiteData();
    const links = await getLinkMetadata();
    const token = request.cookies.get("auth-token")?.value;
    if (token && (await verifyToken(token))) {
      return NextResponse.json({ ...data, links });
    }
    return NextResponse.json({
      ...data,
      links: links.map(toPublicLink),
    });
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

    // Parse and validate request data
    const data = await request.json();

    const aboutError = validateAboutContent(data.about);
    if (aboutError) {
      return NextResponse.json({ error: aboutError }, { status: 400 });
    }

    const photosError = validatePhotos(data.photos);
    if (photosError) {
      return NextResponse.json({ error: photosError }, { status: 400 });
    }

    const linksError = validateLinks(data.links);
    if (linksError) {
      return NextResponse.json({ error: linksError }, { status: 400 });
    }

    // Save site data (about and photos)
    const { links, ...siteData } = data;
    await saveSiteData(siteData);

    // Save links if provided
    if (links) {
      await saveLinkMetadata(links);
    }

    revalidatePath("/");
    await purgePublicPages();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update site data error:", error);
    return NextResponse.json(
      { error: "Failed to update site data" },
      { status: 500 }
    );
  }
}
