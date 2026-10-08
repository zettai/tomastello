import type { ObjectBody, ObjectStore, PutObjectOptions } from "./types";
import { StorePreconditionError } from "./types";

type Entry = { body: string; etag: string; contentType?: string };

/** In-memory object store for unit tests and Playwright (no bucket). */
export class MemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, Entry>();
  private readonly versions = new Map<string, number>();

  private nextEtag(key: string): string {
    const n = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, n);
    return `"mem-${n}"`;
  }

  async get(key: string): Promise<ObjectBody | null> {
    const entry = this.objects.get(key);
    if (!entry) return null;
    return { body: entry.body, etag: entry.etag };
  }

  async put(key: string, body: string, options: PutObjectOptions = {}): Promise<void> {
    const current = this.objects.get(key);
    if (!options.unconditional) {
      if (options.ifNoneMatch && current) throw new StorePreconditionError(key);
      if (options.ifMatch !== undefined && current?.etag !== options.ifMatch) {
        throw new StorePreconditionError(key);
      }
      if (options.ifMatch !== undefined && !current) throw new StorePreconditionError(key);
    }
    const etag = this.nextEtag(key);
    this.objects.set(key, { body, etag, contentType: options.contentType });
  }

  /** Tests only: drop all objects. */
  clear(): void {
    this.objects.clear();
    this.versions.clear();
  }
}
