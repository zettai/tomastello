import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { requireUser } from "@/lib/routeAuth";
import { addImageMetadata, getMetadataByFileName } from "@/lib/metadata";
import { deleteObject, ensureObjectPublic, headObject } from "@/lib/objects";
import {
  getUploadMode,
  IMAGE_MIME_TYPES,
  isUploadKey,
  MAX_IMAGE_SIZE,
  publicObjectUrl,
} from "@/lib/uploads";
import { createLogger } from "@/lib/logger";

const log = createLogger("images/upload/complete");

/**
 * @swagger
 * /api/images/upload/complete:
 *   post:
 *     summary: Register a directly uploaded image (presigned mode)
 *     description: Checks the object the browser uploaded (size and type as the bucket reports them, not as the browser claims) and saves its metadata. An object that breaks the limits is deleted.
 *     tags: [Images]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key]
 *             properties:
 *               key: { type: string, example: "images/1748282806542-photo.jpg" }
 *               originalName: { type: string, example: "photo.jpg" }
 *     responses:
 *       200:
 *         description: Image registered
 *       400:
 *         description: Invalid key, or the uploaded object breaks the limits
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Nothing was uploaded under that key
 *       409:
 *         description: Relay mode, or the image is already registered
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  if (getUploadMode() !== "presigned") {
    return NextResponse.json({ error: "Not available in relay upload mode" }, { status: 409 });
  }

  let body: { key?: unknown; originalName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { key, originalName } = body;
  if (!isUploadKey("images", key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

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
