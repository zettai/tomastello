import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import {
  updateAudioMetadata,
  deleteAudioMetadata,
  getAudioMetadata,
} from "@/lib/audioMetadata";
import { verifyToken } from "@/lib/auth";

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

    const { id } = await context.params;
    const body = await request.json();
    const { title } = body as { title?: string };

    if (title !== undefined && !title.trim()) {
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

    const { id } = await context.params;

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
