import { NextRequest, NextResponse } from "next/server";
import { multipartAbortQuerySchema } from "@/lib/apiSchemas";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { verifyToken } from "@/lib/auth";
import { isUploadKey } from "@/lib/uploads";
import { createLogger } from "@/lib/logger";
import { parseQuery } from "@/lib/validateRequest";

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

  const parsed = parseQuery(
    request.nextUrl.searchParams,
    multipartAbortQuerySchema,
    ["uploadId", "key"]
  );
  if (!parsed.ok) return parsed.response;
  const { uploadId, key } = parsed.data;

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
