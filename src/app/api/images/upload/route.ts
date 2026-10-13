import { NextRequest, NextResponse } from "next/server";
import { imageRelayUploadFormSchema, validateRelayImageFile } from "@/lib/apiSchemas";
import { conflictResponse } from "@/lib/storeErrors";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { addImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";
import { publicObjectUrl } from "@/lib/uploads";
import { invalidRequestResponse, parseFormData } from "@/lib/validateRequest";

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

    const parsed = await parseFormData(
      request,
      imageRelayUploadFormSchema,
      (formData) => ({ file: formData.get("file") })
    );
    if (!parsed.ok) return parsed.response;
    const { file } = parsed.data;

    if (!validateRelayImageFile(file)) {
      return invalidRequestResponse();
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
    const publicUrl = publicObjectUrl(fileName);

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
