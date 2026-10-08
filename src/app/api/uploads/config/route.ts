import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/routeAuth";
import { getChunkSizeMb, getUploadMode } from "@/lib/uploads";

/**
 * @swagger
 * /api/uploads/config:
 *   get:
 *     summary: Upload settings for the admin's browser
 *     description: How uploads reach the bucket (relay through the API or presigned direct uploads) and the multipart chunk size in MB.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Upload settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mode:
 *                   type: string
 *                   enum: [relay, presigned]
 *                 chunkSizeMb:
 *                   type: number
 *                   example: 5
 *       401:
 *         description: Not logged in
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ mode: getUploadMode(), chunkSizeMb: getChunkSizeMb() });
}
