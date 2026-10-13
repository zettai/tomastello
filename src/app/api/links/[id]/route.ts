import { NextRequest, NextResponse } from "next/server";
import { linkIdParamSchema, linkUpdateBodySchema } from "@/lib/apiSchemas";
import { conflictResponse } from "@/lib/storeErrors";
import { verifyToken } from "@/lib/auth";
import { updateLinkMetadata } from "@/lib/links";
import { parseJsonBody, parseParams } from "@/lib/validateRequest";

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

    const routeParams = parseParams(await params, linkIdParamSchema);
    if (!routeParams.ok) return routeParams.response;
    const { id } = routeParams.data;

    const parsed = await parseJsonBody(request, linkUpdateBodySchema);
    if (!parsed.ok) return parsed.response;
    const updates = parsed.data;

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
