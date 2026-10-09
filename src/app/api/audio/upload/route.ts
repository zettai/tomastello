import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { addAudioMetadata } from "@/lib/audioMetadata";
import { verifyToken } from "@/lib/auth";
import { checkRateLimit, recordUpload } from "@/lib/rateLimiter";
import { addSecurityEvent } from "@/lib/securityEvents";
import { notifyServerError } from "@/lib/notifier";
import { createLogger } from "@/lib/logger";
import {
  AUDIO_MIME_TYPES,
  audioExtensionMatches,
  buildObjectKey,
  getExtension,
  MAX_AUDIO_SIZE,
  publicObjectUrl,
} from "@/lib/uploads";

const log = createLogger("audio/upload");

const FLAC_MIME_TYPES = new Set(["audio/flac", "audio/x-flac"]);

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!AUDIO_MIME_TYPES.has(file.type)) {
      await addSecurityEvent({
        type: "upload_rejected_mime",
        ip,
        userEmail: userPayload.email,
        detail: file.type,
      });
      return NextResponse.json(
        { error: "Only audio files are allowed" },
        { status: 400 }
      );
    }

    if (!audioExtensionMatches(file.name, file.type)) {
      await addSecurityEvent({
        type: "upload_rejected_mime",
        ip,
        userEmail: userPayload.email,
        detail: `ext:${getExtension(file.name)} mime:${file.type}`,
      });
      return NextResponse.json(
        { error: "File extension does not match MIME type" },
        { status: 400 }
      );
    }

    if (file.size > MAX_AUDIO_SIZE) {
      await addSecurityEvent({
        type: "upload_rejected_size",
        ip,
        userEmail: userPayload.email,
        detail: `${file.size} bytes`,
      });
      return NextResponse.json(
        { error: "File exceeds the 100 MB limit" },
        { status: 400 }
      );
    }

    if (FLAC_MIME_TYPES.has(file.type)) {
      log.warn("FLAC upload — limited browser support", {
        ip,
        email: userPayload.email,
        fileName: file.name,
      });
    }

    const rateCheck = await checkRateLimit(ip, userPayload.email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason ?? "Rate limit exceeded" },
        { status: 429 }
      );
    }
    const fileName = buildObjectKey("audio", file.name);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const command = new PutObjectCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      ACL: "public-read",
    });

    await scalewayClient.send(command);

    const publicUrl = publicObjectUrl(fileName);

    const metadata = await addAudioMetadata({
      fileName,
      title: title.trim(),
      url: publicUrl,
      size: file.size,
      mimeType: file.type,
      uploadedBy: userPayload.email,
    });

    await recordUpload(ip, userPayload.email, file.size);

    log.info("Audio uploaded", {
      ip,
      email: userPayload.email,
      fileName,
      size: file.size,
    });

    return NextResponse.json({
      success: true,
      fileName,
      url: publicUrl,
      size: file.size,
      mimeType: file.type,
      metadata,
    });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    log.error("Audio upload error", { error: String(error), ip });
    void notifyServerError({
      error: String(error),
      context: "audio/upload POST",
    });
    return NextResponse.json(
      { error: "Failed to upload audio" },
      { status: 500 }
    );
  }
}
