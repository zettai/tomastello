import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { updateImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";

/**
 * @swagger
 * /api/images/metadata/{id}:
 *   put:
 *     summary: Update image metadata
 *     description: Update metadata for a specific image by ID
 *     tags: [Metadata]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the image
 *         example: "img_12345"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Image ID (should match path parameter)
 *                 example: "img_12345"
 *               description:
 *                 type: string
 *                 description: Updated description for the image
 *                 example: "A beautiful sunset over the mountains"
 *               alt:
 *                 type: string
 *                 description: Updated alt text for accessibility
 *                 example: "Sunset with mountain silhouette"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated array of tags
 *                 example: ["nature", "sunset", "mountains", "landscape"]
 *     responses:
 *       200:
 *         description: Metadata updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     metadata:
 *                       $ref: '#/components/schemas/ImageMetadata'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Image ID is required"
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
 *         description: Failed to update metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Failed to update metadata"
 *               success: false
 */
export async function PUT(request: NextRequest) {
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

    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    const updatedMetadata = await updateImageMetadata(id, updates);

    if (!updatedMetadata) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      metadata: updatedMetadata,
    });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Metadata update error:", error);
    return NextResponse.json(
      { error: "Failed to update metadata" },
      { status: 500 }
    );
  }
}
