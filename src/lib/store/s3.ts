import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { SCALEWAY_BUCKET, scalewayClient } from "../api";
import type { ObjectBody, ObjectStore, PutObjectOptions } from "./types";
import { StoreNotImplementedError, StorePreconditionError } from "./types";

function errorName(error: unknown): string | undefined {
  return (error as { name?: string })?.name;
}

function isMissingKey(error: unknown): boolean {
  const name = errorName(error);
  if (name === "NoSuchKey" || name === "NotFound") return true;
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return status === 404;
}

/** Production store: Scaleway object storage (existing bucket). */
export class S3ObjectStore implements ObjectStore {
  async get(key: string): Promise<ObjectBody | null> {
    try {
      const res = await scalewayClient.send(new GetObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: key }));
      if (!res.Body) return { body: "", etag: res.ETag ?? null };
      return { body: await res.Body.transformToString(), etag: res.ETag ?? null };
    } catch (error) {
      if (isMissingKey(error)) return null;
      throw error;
    }
  }

  async head(key: string): Promise<{ etag: string } | null> {
    try {
      const res = await scalewayClient.send(new HeadObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: key }));
      if (!res.ETag) return null;
      return { etag: res.ETag };
    } catch (error) {
      if (isMissingKey(error)) return null;
      throw error;
    }
  }

  async put(key: string, body: string, options: PutObjectOptions = {}): Promise<void> {
    const base = {
      Bucket: SCALEWAY_BUCKET,
      Key: key,
      Body: body,
      ContentType: options.contentType ?? "application/octet-stream",
    };
    const conditional =
      options.unconditional
        ? {}
        : options.ifNoneMatch
          ? { IfNoneMatch: "*" }
          : options.ifMatch
            ? { IfMatch: options.ifMatch }
            : {};
    try {
      await scalewayClient.send(new PutObjectCommand({ ...base, ...conditional }));
    } catch (error) {
      const name = errorName(error);
      if (name === "PreconditionFailed" || name === "ConditionalRequestConflict") {
        throw new StorePreconditionError(key);
      }
      if (name === "NotImplemented") throw new StoreNotImplementedError("conditional writes");
      throw error;
    }
  }
}
