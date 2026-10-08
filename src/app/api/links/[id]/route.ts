import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { verifyToken } from "@/lib/auth";
import { updateLinkMetadata } from "@/lib/links";

// PUT /api/links/[id] - Update link (auth required)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Link ID is required" },
        { status: 400 }
      );
    }

    // Parse request body
    const updates = await request.json();

    // Validate required fields if being updated
    if (updates.text !== undefined && !updates.text) {
      return NextResponse.json(
        { error: "Text cannot be empty" },
        { status: 400 }
      );
    }

    if (updates.href !== undefined && !updates.href) {
      return NextResponse.json(
        { error: "Href cannot be empty" },
        { status: 400 }
      );
    }

    // Validate types if being updated
    if (updates.text !== undefined && typeof updates.text !== "string") {
      return NextResponse.json(
        { error: "Text must be a string" },
        { status: 400 }
      );
    }

    if (updates.href !== undefined && typeof updates.href !== "string") {
      return NextResponse.json(
        { error: "Href must be a string" },
        { status: 400 }
      );
    }

    const updatedLink = await updateLinkMetadata(id, updates);

    if (!updatedLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, link: updatedLink });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Failed to update link:", error);
    return NextResponse.json(
      { error: "Failed to update link", success: false },
      { status: 500 }
    );
  }
}
