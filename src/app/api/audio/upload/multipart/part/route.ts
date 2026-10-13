import { NextRequest, NextResponse } from "next/server";
import { multipartPartPresignQuerySchema, multipartPartQuerySchema } from "@/lib/apiSchemas";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { requireUser } from "@/lib/routeAuth";
import { presignUploadPart } from "@/lib/presign";
import {
  getUploadMode,
  MAX_PART_SIZE,
  PRESIGN_EXPIRY_SECONDS,
  type UploadMode,
} from "@/lib/uploads";
import { createLogger } from "@/lib/logger";
import { parseQuery } from "@/lib/validateRequest";

const log = createLogger("audio/upload/multipart/part");

function wrongMode(mode: UploadMode): NextResponse {
  return NextResponse.json({ error: `Not available in ${mode} upload mode` }, { status: 409 });
}

/** Relay mode: the browser sends the part's bytes here and we forward them to the bucket. */
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const mode = getUploadMode();
  if (mode !== "relay") return wrongMode(mode);

  const parsed = parseQuery(
    request.nextUrl.searchParams,
    multipartPartQuerySchema,
    ["uploadId", "key", "partNumber"]
  );
  if (!parsed.ok) return parsed.response;
  const { uploadId, key, partNumber } = parsed.data;

  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_PART_SIZE) {
      return NextResponse.json({ error: "Part too large" }, { status: 413 });
    }

    const response = await scalewayClient.send(
      new UploadPartCommand({
        Bucket: SCALEWAY_BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: Buffer.from(body),
      })
    );

    log.debug("Part uploaded", { key, partNumber, etag: response.ETag });
    return NextResponse.json({ etag: response.ETag, partNumber });
  } catch (error) {
    log.error("Part upload error", { error: String(error), key, partNumber });
    return NextResponse.json({ error: "Failed to upload part" }, { status: 500 });
  }
}

/**
 * Presigned mode: returns a short-lived URL the browser PUTs this part to directly.
 * `size` (bytes) is signed, so the bucket rejects a part of any other size. The bucket
 * returns the part's ETag in a response header (CORS must expose it).
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const mode = getUploadMode();
  if (mode !== "presigned") return wrongMode(mode);

  const parsed = parseQuery(
    request.nextUrl.searchParams,
    multipartPartPresignQuerySchema,
    ["uploadId", "key", "partNumber", "size"]
  );
  if (!parsed.ok) return parsed.response;
  const { uploadId, key, partNumber, size } = parsed.data;

  try {
    const url = await presignUploadPart(key, uploadId, partNumber, size);
    return NextResponse.json({ url, partNumber, expiresIn: PRESIGN_EXPIRY_SECONDS });
  } catch (error) {
    log.error("Part presign error", { error: String(error), key, partNumber });
    return NextResponse.json({ error: "Failed to sign part" }, { status: 500 });
  }
}
