import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { purgePublicPages } from "@/lib/cdn";
import { getMetadataByFileName, deleteImageMetadata } from "@/lib/metadata";
import { removeSitePhotoByKey } from "@/lib/site";
import { verifyToken } from "@/lib/auth";

/**
 * @swagger
 * /api/images/delete:
 *   delete:
 *     summary: Delete an image
 *     description: Delete an image from Scaleway Object Storage and remove its metadata
 *     tags: [Images]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename/key of the image to delete
 *         example: "images/1748282806542-example.jpg"
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Image deleted successfully"
 *       400:
 *         description: Missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "File key is required"
 *               success: false
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Authentication required"
 *               success: false
 *       404:
 *         description: Image not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Image not found"
 *               success: false
 *       500:
 *         description: Failed to delete image
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Failed to delete image"
 *               success: false
 */
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
