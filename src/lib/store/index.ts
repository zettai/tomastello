import path from "node:path";
import { FileObjectStore } from "./file";
import { MemoryObjectStore } from "./memory";
import { S3ObjectStore } from "./s3";
import type { ObjectStore } from "./types";

export { FileObjectStore } from "./file";
export { MemoryObjectStore } from "./memory";
export { S3ObjectStore } from "./s3";
export type { ObjectStore } from "./types";
export { StoreNotImplementedError, StorePreconditionError } from "./types";

type Env = Record<string, string | undefined>;

const S3_KEYS = ["SCW_ACCESS_KEY", "SCW_SECRET_KEY", "SCALEWAY_BUCKET"] as const;

function s3Configured(env: Env): boolean {
  return S3_KEYS.every((k) => Boolean(env[k]?.trim()));
}

export function createObjectStoreFromEnv(env: Env = process.env): ObjectStore {
  const mode = env.TOMASTELLO_STORE?.trim().toLowerCase();
  if (mode === "memory") return new MemoryObjectStore();
  if (mode === "file") {
    const dir = env.TOMASTELLO_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
    return new FileObjectStore(dir);
  }
  if (mode === "s3" || s3Configured(env)) return new S3ObjectStore();
  const dir = env.TOMASTELLO_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
  return new FileObjectStore(dir);
}

let cached: ObjectStore | undefined;

export function getObjectStore(): ObjectStore {
  cached ??= createObjectStoreFromEnv();
  return cached;
}

/** Tests / Playwright: replace the process store. */
export function setObjectStoreForTests(store: ObjectStore | undefined): void {
  cached = store;
}
