import { PutObjectCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { presignClient, SCALEWAY_BUCKET } from "./api";
import { PRESIGN_EXPIRY_SECONDS } from "./uploads";

/**
 * Content-Length (and Content-Type for objects) are signed, so the browser must send
 * exactly the size and type the server approved: a bigger or different body fails the
 * signature check at the bucket.
 */
const SIGNED_HEADERS = new Set(["content-type", "content-length"]);

/** A signed PUT for one whole object. Public-read, like relayed uploads. */
export function presignObjectPut(key: string, contentType: string, size: number): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: SCALEWAY_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    ACL: "public-read",
  });
  return getSignedUrl(presignClient, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
    signableHeaders: SIGNED_HEADERS,
  });
}

/** A signed PUT for one part of a multipart upload started by multipart/init. */
export function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  size: number
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: SCALEWAY_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    ContentLength: size,
  });
  return getSignedUrl(presignClient, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
    signableHeaders: new Set(["content-length"]),
  });
}
