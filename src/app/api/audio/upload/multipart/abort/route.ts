import { NextRequest, NextResponse } from "next/server";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { verifyToken } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { isUploadKey } from "@/lib/uploads";

const log = createLogger("audio/upload/multipart/abort");

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userPayload = await verifyToken(token);
  if (!userPayload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const uploadId = searchParams.get("uploadId");
  const key = searchParams.get("key");

  if (!uploadId || !key) {
    return NextResponse.json(
      { error: "uploadId and key are required" },
      { status: 400 }
    );
  }

  if (!isUploadKey("audio", key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: key,
      UploadId: uploadId,
    });

    await scalewayClient.send(command);

    log.info("Multipart upload aborted", {
      email: userPayload.email,
      key,
      uploadId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Multipart abort error", { error: String(error), key });
    return NextResponse.json(
      { error: "Failed to abort upload" },
      { status: 500 }
    );
  }
}
