import { NextRequest, NextResponse } from "next/server";
import { audioReorderBodySchema } from "@/lib/apiSchemas";
import { conflictResponse } from "@/lib/storeErrors";
import { reorderAudioMetadata } from "@/lib/audioMetadata";
import { verifyToken } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validateRequest";

export async function PUT(request: NextRequest) {
  try {
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

    const parsed = await parseJsonBody(request, audioReorderBodySchema);
    if (!parsed.ok) return parsed.response;
    const { ids } = parsed.data;

    const result = await reorderAudioMetadata(ids);

    return NextResponse.json({ success: true, audio: result });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Audio reorder error:", error);
    return NextResponse.json(
      { error: "Failed to reorder audio" },
      { status: 500 }
    );
  }
}
