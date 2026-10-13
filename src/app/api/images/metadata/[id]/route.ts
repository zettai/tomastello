import { NextRequest, NextResponse } from "next/server";
import { imageMetadataUpdateBodySchema } from "@/lib/apiSchemas";
import { conflictResponse } from "@/lib/storeErrors";
import { updateImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validateRequest";

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

    const parsed = await parseJsonBody(request, imageMetadataUpdateBodySchema);
    if (!parsed.ok) return parsed.response;
    const { id, ...updates } = parsed.data;

    const updatedMetadata = await updateImageMetadata(id, updates);

    if (!updatedMetadata) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      metadata: updatedMetadata,
    });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Metadata update error:", error);
    return NextResponse.json(
      { error: "Failed to update metadata" },
      { status: 500 }
    );
  }
}
