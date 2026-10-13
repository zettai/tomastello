import { NextRequest, NextResponse } from "next/server";
import { audioIdParamSchema, audioUpdateBodySchema } from "@/lib/apiSchemas";
import { conflictResponse } from "@/lib/storeErrors";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import {
  updateAudioMetadata,
  deleteAudioMetadata,
  getAudioMetadata,
} from "@/lib/audioMetadata";
import { purgePublicPages } from "@/lib/cdn";
import { verifyToken } from "@/lib/auth";
import { parseJsonBody, parseParams } from "@/lib/validateRequest";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Params) {
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

    const routeParams = parseParams(await context.params, audioIdParamSchema);
    if (!routeParams.ok) return routeParams.response;
    const { id } = routeParams.data;

    const parsed = await parseJsonBody(request, audioUpdateBodySchema);
    if (!parsed.ok) return parsed.response;
    const { title } = parsed.data;

    if (title !== undefined && title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title cannot be blank" },
        { status: 400 }
      );
    }

    const updated = await updateAudioMetadata(id, { title: title?.trim() });

    if (!updated) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, audio: updated });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Audio update error:", error);
    return NextResponse.json(
      { error: "Failed to update audio" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: Params) {
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

    const routeParams = parseParams(await context.params, audioIdParamSchema);
    if (!routeParams.ok) return routeParams.response;
    const { id } = routeParams.data;

    const allAudio = await getAudioMetadata();
    const audioItem = allAudio.find((a) => a.id === id);

    if (!audioItem) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const s3Command = new DeleteObjectCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: audioItem.fileName,
    });
    await scalewayClient.send(s3Command);

    await deleteAudioMetadata(id);
    await purgePublicPages();

    return NextResponse.json({
      success: true,
      message: "Audio deleted successfully",
    });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Audio delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete audio" },
      { status: 500 }
    );
  }
}
