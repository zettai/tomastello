import { NextRequest, NextResponse } from "next/server";
import { getImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";

/**
 * @swagger
 * /api/images/metadata:
 *   get:
 *     summary: Get all image metadata
 *     description: Retrieve metadata for all uploaded images
 *     tags: [Metadata]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Metadata retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     metadata:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ImageMetadata'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Authentication required"
 *               success: false
 *       500:
 *         description: Failed to retrieve metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Failed to retrieve metadata"
 *               success: false
 */
export async function GET(request: NextRequest) {
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

    const metadata = await getImageMetadata();

    return NextResponse.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error("Metadata fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 }
    );
  }
}
