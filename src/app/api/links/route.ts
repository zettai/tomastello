import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { verifyToken } from "@/lib/auth";
import { toPublicLink } from "@/lib/publicView";
import {
  getLinkMetadata,
  addLinkMetadata,
  deleteLinkMetadata,
} from "@/lib/links";

// GET /api/links - List all links (createdBy, an admin email, only for admins)
export async function GET(request: NextRequest) {
  try {
    const links = await getLinkMetadata();
    const token = request.cookies.get("auth-token")?.value;
    if (token && (await verifyToken(token))) {
      return NextResponse.json({ success: true, links });
    }
    return NextResponse.json({
      success: true,
      links: links.map(toPublicLink),
    });
  } catch (error) {
    console.error("Failed to get links:", error);
    return NextResponse.json(
      { error: "Failed to retrieve links", success: false },
      { status: 500 }
    );
  }
}

// POST /api/links - Create new link (auth required)
export async function POST(request: NextRequest) {
  try {
    // Authentication check
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

    // Parse request body
    const body = await request.json();
    const { text, href, description } = body;

    // Validate required fields
    if (!text || !href) {
      return NextResponse.json(
        { error: "Text and href are required" },
        { status: 400 }
      );
    }

    // Validate types
    if (typeof text !== "string" || typeof href !== "string") {
      return NextResponse.json(
        { error: "Text and href must be strings" },
        { status: 400 }
      );
    }

    // Create link
    const newLink = await addLinkMetadata({
      text,
      href,
      description,
      createdBy: userPayload.email,
    });

    return NextResponse.json({ success: true, link: newLink });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Failed to create link:", error);
    return NextResponse.json(
      { error: "Failed to create link", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/links?id=... - Delete link (auth required)
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
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

    // Get id from query params
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Link ID is required" },
        { status: 400 }
      );
    }

    const success = await deleteLinkMetadata(id);

    if (!success) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Failed to delete link:", error);
    return NextResponse.json(
      { error: "Failed to delete link", success: false },
      { status: 500 }
    );
  }
}
