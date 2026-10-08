import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { verifyToken } from "@/lib/auth";
import { addAudioMetadata } from "@/lib/audioMetadata";
import { recordUpload } from "@/lib/rateLimiter";
import { notifyServerError } from "@/lib/notifier";
import { deleteObject, ensureObjectPublic, headObject } from "@/lib/objects";
import { isUploadKey, MAX_AUDIO_SIZE, publicObjectUrl } from "@/lib/uploads";
import { createLogger } from "@/lib/logger";

const log = createLogger("audio/upload/multipart/complete");

interface CompletePart {
  partNumber: number;
  etag: string;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userPayload = await verifyToken(token);
  if (!userPayload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      uploadId?: string;
      key?: string;
      parts?: CompletePart[];
      title?: string;
      mimeType?: string;
      size?: number;
    };
    const { uploadId, key, parts, title, mimeType, size } = body;

    if (!uploadId || !key || !parts || !title || !mimeType || size === undefined) {
      return NextResponse.json(
        { error: "uploadId, key, parts, title, mimeType, and size are required" },
        { status: 400 }
      );
    }

    if (!isUploadKey("audio", key) || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: "Invalid key or parts" }, { status: 400 });
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    });

    await scalewayClient.send(command);

    // Trust the bucket, not the browser: parts may have gone straight to the bucket.
    const stored = await headObject(key);
    if (!stored || stored.size > MAX_AUDIO_SIZE) {
      if (stored) await deleteObject(key);
      log.warn("Rejected completed upload", { ip, key, size: stored?.size });
      return NextResponse.json({ error: "File exceeds the 100 MB limit" }, { status: 400 });
    }
    const actualSize = stored.size;

    await ensureObjectPublic(key);

    const publicUrl = publicObjectUrl(key);

    const metadata = await addAudioMetadata({
      fileName: key,
      title: title.trim(),
      url: publicUrl,
      size: actualSize,
      mimeType,
      uploadedBy: userPayload.email,
    });

    await recordUpload(ip, userPayload.email, actualSize);

    log.info("Multipart upload completed", {
      ip,
      email: userPayload.email,
      key,
      size: actualSize,
    });

    return NextResponse.json({ success: true, url: publicUrl, metadata });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    log.error("Multipart complete error", { error: String(error), ip });
    void notifyServerError({
      error: String(error),
      context: "audio/upload/multipart/complete POST",
    });
    return NextResponse.json(
      { error: "Failed to complete upload" },
      { status: 500 }
    );
  }
}
