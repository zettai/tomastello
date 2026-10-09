import { createLogger } from "./logger";
import { getObjectStore } from "./store";
import { StoreNotImplementedError, StorePreconditionError } from "./store/types";

/**
 * JSON documents in the bucket with optimistic concurrency.
 *
 * Every write is conditional: `If-Match: <etag read>` for an existing document, or
 * `If-None-Match: *` when it didn't exist. If another instance saved in between, the bucket
 * answers 412 and updateJson re-reads, re-applies the change and tries again; after a few
 * attempts it throws ConflictError, which routes turn into 409. Without this, two serverless
 * instances saving at once silently lose one of the changes.
 */

const log = createLogger("jsonStore");

export const MAX_ATTEMPTS = 6;
/** Base of the randomised backoff between attempts (ms); doubles each time. */
const BACKOFF_BASE_MS = 25;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Full-jitter backoff: random 0..base·2^attempt, so colliding writers spread out. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  return Math.floor(random() * BACKOFF_BASE_MS * 2 ** attempt);
}

export class ConflictError extends Error {
  constructor(readonly key: string) {
    super(`${key} was changed by another request; try again`);
    this.name = "ConflictError";
  }
}

export interface Versioned<T> {
  data: T;
  /** The document's ETag, or null when it doesn't exist yet. */
  etag: string | null;
}

/** Set once a bucket has refused conditional headers: later writes skip them. */
let conditionalWritesUnsupported = false;

/** Reads a JSON document and its ETag; `fallback` (etag null) if it doesn't exist. */
export async function readJson<T>(key: string, fallback: T): Promise<Versioned<T>> {
  const res = await getObjectStore().get(key);
  if (!res) return { data: fallback, etag: null };
  if (!res.body) return { data: fallback, etag: res.etag };
  return { data: JSON.parse(res.body) as T, etag: res.etag };
}

/**
 * Writes a JSON document only if it still has `expectedEtag` (null: only if it doesn't exist).
 * Throws ConflictError when the condition fails.
 */
export async function writeJson(key: string, data: unknown, expectedEtag: string | null): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  const store = getObjectStore();
  const options =
    conditionalWritesUnsupported
      ? { contentType: "application/json", unconditional: true }
      : expectedEtag === null
        ? { contentType: "application/json", ifNoneMatch: true }
        : { contentType: "application/json", ifMatch: expectedEtag };
  try {
    await store.put(key, body, options);
  } catch (error) {
    if (error instanceof StorePreconditionError) throw new ConflictError(key);
    if (error instanceof StoreNotImplementedError && !conditionalWritesUnsupported) {
      conditionalWritesUnsupported = true;
      log.error("Bucket refused conditional writes; concurrent saves are no longer protected", { key });
      await store.put(key, body, { contentType: "application/json", unconditional: true });
      return;
    }
    throw error;
  }
}

/** Unconditional JSON replace (tests / rare admin wipe paths). */
export async function replaceJson(key: string, data: unknown): Promise<void> {
  await getObjectStore().put(key, JSON.stringify(data, null, 2), {
    contentType: "application/json",
    unconditional: true,
  });
}

/**
 * Read-modify-write with retries. `mutate` gets the current document and returns the new one,
 * or the same object to leave it untouched (nothing is written). It may run more than once, so
 * it must not have side effects beyond recording what it found. Returns the stored document.
 */
export async function updateJson<T>(
  key: string,
  fallback: T,
  mutate: (current: T) => T,
  options: { wait?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const wait = options.wait ?? sleep;
  for (let attempt = 1; ; attempt++) {
    const { data, etag } = await readJson(key, fallback);
    const next = mutate(data);
    if (next === data) return data;
    try {
      await writeJson(key, next, etag);
      return next;
    } catch (error) {
      if (!(error instanceof ConflictError) || attempt === MAX_ATTEMPTS) throw error;
      log.warn("Concurrent write, retrying", { key, attempt });
      await wait(backoffMs(attempt));
    }
  }
}

/** Tests only. */
export function resetConditionalWriteSupportForTests(): void {
  conditionalWritesUnsupported = false;
}
