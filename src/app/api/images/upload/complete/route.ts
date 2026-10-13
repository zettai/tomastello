import { NextRequest, NextResponse } from "next/server";
import { imageCompleteBodySchema } from "@/lib/apiSchemas";
import { conflictResponse } from "@/lib/storeErrors";
import { requireUser } from "@/lib/routeAuth";
import { addImageMetadata, getMetadataByFileName } from "@/lib/metadata";
import { deleteObject, ensureObjectPublic, headObject } from "@/lib/objects";
import {
  getUploadMode,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  publicObjectUrl,
} from "@/lib/uploads";
import { createLogger } from "@/lib/logger";
import { parseJsonBody } from "@/lib/validateRequest";

const log = createLogger("images/upload/complete");

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  if (getUploadMode() !== "presigned") {
    return NextResponse.json({ error: "Not available in relay upload mode" }, { status: 409 });
  }

  const parsed = await parseJsonBody(request, imageCompleteBodySchema);
  if (!parsed.ok) return parsed.response;
  const { key, originalName } = parsed.data;

  try {
    if (await getMetadataByFileName(key)) {
      return NextResponse.json({ error: "Image already registered" }, { status: 409 });
    }

    const stored = await headObject(key);
    if (!stored) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }
    if (!IMAGE_MIME_TYPES.has(stored.contentType) || stored.size < 1 || stored.size > MAX_IMAGE_SIZE) {
      await deleteObject(key);
      log.warn("Rejected direct image upload", { key, ...stored });
      return NextResponse.json({ error: "Uploaded file is not an allowed image" }, { status: 400 });
    }

    await ensureObjectPublic(key);

    const url = publicObjectUrl(key);
    const name = typeof originalName === "string" && originalName.trim() ? originalName.trim() : key.split("/")[1];
    const metadata = await addImageMetadata({
      fileName: key,
      originalName: name,
      url,
      size: stored.size,
      type: stored.contentType,
      uploadedBy: auth.user.email,
    });

    return NextResponse.json({
      success: true,
      fileName: key,
      url,
      size: stored.size,
      type: stored.contentType,
      metadata,
    });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    log.error("Image complete error", { error: String(error), key });
    return NextResponse.json({ error: "Failed to register image" }, { status: 500 });
  }
}
