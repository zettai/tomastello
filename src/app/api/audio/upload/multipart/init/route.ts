import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { verifyToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";
import { addSecurityEvent } from "@/lib/securityEvents";
import { createLogger } from "@/lib/logger";
import {
  AUDIO_MIME_TYPES,
  audioExtensionMatches,
  buildObjectKey,
  getExtension,
  MAX_AUDIO_SIZE,
} from "@/lib/uploads";

const log = createLogger("audio/upload/multipart/init");

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
      fileName?: string;
      mimeType?: string;
      size?: number;
    };
    const { fileName, mimeType, size } = body;

    if (!fileName || !mimeType || size === undefined) {
      return NextResponse.json(
        { error: "fileName, mimeType, and size are required" },
        { status: 400 }
      );
    }

    if (!AUDIO_MIME_TYPES.has(mimeType)) {
      await addSecurityEvent({
        type: "upload_rejected_mime",
        ip,
        userEmail: userPayload.email,
        detail: mimeType,
      });
      return NextResponse.json(
        { error: "Only audio files are allowed" },
        { status: 400 }
      );
    }

    if (!audioExtensionMatches(fileName, mimeType)) {
      await addSecurityEvent({
        type: "upload_rejected_mime",
        ip,
        userEmail: userPayload.email,
        detail: `ext:${getExtension(fileName)} mime:${mimeType}`,
      });
      return NextResponse.json(
        { error: "File extension does not match MIME type" },
        { status: 400 }
      );
    }

    if (size > MAX_AUDIO_SIZE) {
      await addSecurityEvent({
        type: "upload_rejected_size",
        ip,
        userEmail: userPayload.email,
        detail: `${size} bytes`,
      });
      return NextResponse.json(
        { error: "File exceeds the 100 MB limit" },
        { status: 400 }
      );
    }

    const rateCheck = await checkRateLimit(ip, userPayload.email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason ?? "Rate limit exceeded" },
        { status: 429 }
      );
    }
    const key = buildObjectKey("audio", fileName);

    const command = new CreateMultipartUploadCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: key,
      ContentType: mimeType,
      ACL: "public-read",
    });

    const response = await scalewayClient.send(command);

    log.info("Multipart upload initiated", {
      ip,
      email: userPayload.email,
      key,
    });

    return NextResponse.json({ uploadId: response.UploadId, key });
  } catch (error) {
    log.error("Multipart init error", { error: String(error), ip });
    return NextResponse.json(
      { error: "Failed to initiate upload" },
      { status: 500 }
    );
  }
}
