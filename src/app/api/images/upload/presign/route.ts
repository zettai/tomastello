import { NextRequest, NextResponse } from "next/server";
import { imagePresignBodySchema } from "@/lib/apiSchemas";
import { clientIp, requireUser } from "@/lib/routeAuth";
import { presignObjectPut } from "@/lib/presign";
import {
  buildObjectKey,
  getUploadMode,
  PRESIGN_EXPIRY_SECONDS,
} from "@/lib/uploads";
import { createLogger } from "@/lib/logger";
import { parseJsonBody } from "@/lib/validateRequest";

const log = createLogger("images/upload/presign");

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  if (getUploadMode() !== "presigned") {
    return NextResponse.json({ error: "Not available in relay upload mode" }, { status: 409 });
  }

  const parsed = await parseJsonBody(request, imagePresignBodySchema);
  if (!parsed.ok) return parsed.response;
  const { fileName, contentType, size } = parsed.data;

  const key = buildObjectKey("images", fileName);
  try {
    const url = await presignObjectPut(key, contentType, size);
    log.info("Image upload signed", { ip: clientIp(request), email: auth.user.email, key, size });
    return NextResponse.json({
      url,
      key,
      headers: { "Content-Type": contentType },
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });
  } catch (error) {
    log.error("Image presign error", { error: String(error), key });
    return NextResponse.json({ error: "Failed to sign upload" }, { status: 500 });
  }
}
