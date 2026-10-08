import { DeleteObjectCommand, HeadObjectCommand, PutObjectAclCommand } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "./api";

export interface StoredObject {
  size: number;
  contentType: string;
}

/**
 * Size and type of an object as the bucket reports them, or null if it doesn't exist.
 * Used after direct uploads, so metadata never trusts what the browser claimed.
 */
export async function headObject(key: string): Promise<StoredObject | null> {
  try {
    const res = await scalewayClient.send(new HeadObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await scalewayClient.send(new DeleteObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: key }));
}

/** Presigned browser PUTs do not send ACL headers; relay uploads do. Make direct uploads public. */
export async function ensureObjectPublic(key: string): Promise<void> {
  await scalewayClient.send(
    new PutObjectAclCommand({ Bucket: SCALEWAY_BUCKET, Key: key, ACL: "public-read" }),
  );
}
