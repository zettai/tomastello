import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { requireUser } from "@/lib/routeAuth";
import { presignUploadPart } from "@/lib/presign";
import {
  getUploadMode,
  isUploadKey,
  MAX_PART_NUMBER,
  MAX_PART_SIZE,
  PRESIGN_EXPIRY_SECONDS,
  type UploadMode,
} from "@/lib/uploads";
import { createLogger } from "@/lib/logger";

const log = createLogger("audio/upload/multipart/part");

type PartParams = { uploadId: string; key: string; partNumber: number };
type ParamsResult = { params: PartParams; response?: undefined } | { params?: undefined; response: NextResponse };

/** Validates uploadId, key and partNumber; returns them or the 400 response to send. */
function readPartParams(request: NextRequest): ParamsResult {
  const { searchParams } = request.nextUrl;
  const uploadId = searchParams.get("uploadId");
  const key = searchParams.get("key");
  const partNumberStr = searchParams.get("partNumber");

  if (!uploadId || !key || !partNumberStr) {
    return { response: NextResponse.json({ error: "uploadId, key, and partNumber are required" }, { status: 400 }) };
  }
  if (!isUploadKey("audio", key)) {
    return { response: NextResponse.json({ error: "Invalid key" }, { status: 400 }) };
  }
  const partNumber = Number(partNumberStr);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PART_NUMBER) {
    return { response: NextResponse.json({ error: "Invalid partNumber" }, { status: 400 }) };
  }
  return { params: { uploadId, key, partNumber } };
}

function wrongMode(mode: UploadMode): NextResponse {
  return NextResponse.json({ error: `Not available in ${mode} upload mode` }, { status: 409 });
}

/** Relay mode: the browser sends the part's bytes here and we forward them to the bucket. */
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const mode = getUploadMode();
  if (mode !== "relay") return wrongMode(mode);

  const parsed = readPartParams(request);
  if (parsed.response) return parsed.response;
  const { uploadId, key, partNumber } = parsed.params;

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

  const parsed = readPartParams(request);
  if (parsed.response) return parsed.response;
  const { uploadId, key, partNumber } = parsed.params;

  const size = Number(request.nextUrl.searchParams.get("size"));
  if (!Number.isInteger(size) || size < 1 || size > MAX_PART_SIZE) {
    return NextResponse.json({ error: "Invalid size" }, { status: 400 });
  }

  try {
    const url = await presignUploadPart(key, uploadId, partNumber, size);
    return NextResponse.json({ url, partNumber, expiresIn: PRESIGN_EXPIRY_SECONDS });
  } catch (error) {
    log.error("Part presign error", { error: String(error), key, partNumber });
    return NextResponse.json({ error: "Failed to sign part" }, { status: 500 });
  }
}
