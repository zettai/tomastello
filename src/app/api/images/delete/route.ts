import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { purgePublicPages } from "@/lib/cdn";
import { getMetadataByFileName, deleteImageMetadata } from "@/lib/metadata";
import { removeSitePhotoByKey } from "@/lib/site";
import { verifyToken } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Image key is required" },
        { status: 400 }
      );
    }

    // Find and delete metadata first
    const metadata = await getMetadataByFileName(key);
    if (metadata) {
      await deleteImageMetadata(metadata.id);
    }

    const command = new DeleteObjectCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: key,
    });

    await scalewayClient.send(command);

    await removeSitePhotoByKey(key);
    await purgePublicPages();

    return NextResponse.json({
      success: true,
      message: "Image and metadata deleted successfully",
    });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
