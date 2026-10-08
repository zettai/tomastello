import { NextRequest, NextResponse } from "next/server";
import { clientIp, requireUser } from "@/lib/routeAuth";
import { presignObjectPut } from "@/lib/presign";
import {
  buildObjectKey,
  getUploadMode,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  PRESIGN_EXPIRY_SECONDS,
} from "@/lib/uploads";
import { createLogger } from "@/lib/logger";

const log = createLogger("images/upload/presign");

/**
 * @swagger
 * /api/images/upload/presign:
 *   post:
 *     summary: Sign a direct image upload (presigned mode)
 *     description: Returns a URL valid for 5 minutes that the browser PUTs the image to, with the returned headers. The server picks the object key; size and type are signed. Then call /api/images/upload/complete.
 *     tags: [Images]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName, contentType, size]
 *             properties:
 *               fileName: { type: string, example: "photo.jpg" }
 *               contentType: { type: string, example: "image/jpeg" }
 *               size: { type: number, example: 204800 }
 *     responses:
 *       200:
 *         description: Signed upload
 *       400:
 *         description: Missing fields, type not allowed or file too large
 *       401:
 *         description: Not logged in
 *       409:
 *         description: Uploads are in relay mode
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  if (getUploadMode() !== "presigned") {
    return NextResponse.json({ error: "Not available in relay upload mode" }, { status: 409 });
  }

  let body: { fileName?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { fileName, contentType, size } = body;

  if (typeof fileName !== "string" || !fileName || typeof contentType !== "string" || typeof size !== "number") {
    return NextResponse.json({ error: "fileName, contentType and size are required" }, { status: 400 });
  }
  if (!IMAGE_MIME_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, GIF and AVIF images are allowed" }, { status: 400 });
  }
  if (!Number.isInteger(size) || size < 1) {
    return NextResponse.json(
      { error: "File size must be a positive whole number" },
      { status: 400 }
    );
  }
  if (size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "File size must be less than 30MB" }, { status: 400 });
  }

  const key = buildObjectKey("images", fileName);
  try {
    const url = await presignObjectPut(key, contentType, size);
    log.info("Image upload signed", { ip: clientIp(request), email: auth.user.email, key, size });
    return NextResponse.json({
      url,
      key,
      headers: { "Content-Type": contentType },
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });
  } catch (error) {
    log.error("Image presign error", { error: String(error), key });
    return NextResponse.json({ error: "Failed to sign upload" }, { status: 500 });
  }
}
