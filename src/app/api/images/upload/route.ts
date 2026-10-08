import { NextRequest, NextResponse } from "next/server";
import { conflictResponse } from "@/lib/storeErrors";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { addImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";

/**
 * @swagger
 * /api/images/upload:
 *   post:
 *     summary: Upload an image
 *     description: Upload an image file to Scaleway Object Storage with automatic metadata creation
 *     tags: [Images]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload (JPEG, PNG, GIF, WebP)
 *               description:
 *                 type: string
 *                 description: Optional description for the image
 *                 example: "A beautiful sunset over the mountains"
 *               alt:
 *                 type: string
 *                 description: Optional alt text for accessibility
 *                 example: "Sunset with mountain silhouette"
 *               tags:
 *                 type: string
 *                 description: Comma-separated tags for categorization
 *                 example: "nature,sunset,mountains,landscape"
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Image uploaded successfully"
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: Public URL of the uploaded image
 *                     fileName:
 *                       type: string
 *                       description: Generated filename in storage
 *                     metadata:
 *                       $ref: '#/components/schemas/ImageMetadata'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               no_file:
 *                 summary: No file provided
 *                 value:
 *                   error: "No file provided"
 *                   success: false
 *               invalid_type:
 *                 summary: Invalid file type
 *                 value:
 *                   error: "Invalid file type. Only images are allowed."
 *                   success: false
 *               file_too_large:
 *                 summary: File too large
 *                 value:
 *                   error: "File size exceeds 10MB limit"
 *                   success: false
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
 *         description: Upload failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Failed to upload image"
 *               success: false
 */
export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (30MB limit)
    const maxSize = 30 * 1024 * 1024; // 30MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 30MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replaceAll(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `images/${timestamp}-${sanitizedName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Scaleway
    const command = new PutObjectCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      ACL: "public-read", // Make images publicly accessible
    });

    await scalewayClient.send(command);

    // Generate public URL
    const publicUrl = `https://${SCALEWAY_BUCKET}.s3.${process.env.SCW_DEFAULT_REGION}.scw.cloud/${fileName}`;

    // Save metadata
    const metadata = await addImageMetadata({
      fileName,
      originalName: file.name,
      url: publicUrl,
      size: file.size,
      type: file.type,
      uploadedBy: userPayload.email,
    });

    return NextResponse.json({
      success: true,
      fileName,
      url: publicUrl,
      size: file.size,
      type: file.type,
      metadata,
    });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
