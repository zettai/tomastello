import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ObjectBody, ObjectStore, PutObjectOptions } from "./types";
import { StorePreconditionError } from "./types";

/**
 * Local scratch store: <dir>/objects/<key> plus a sidecar .etag file.
 * Used for dev and Playwright when Scaleway env is unset.
 */
export class FileObjectStore implements ObjectStore {
  constructor(private readonly rootDir: string) {}

  private objectPath(key: string): string {
    const safe = key.replace(/\.\./g, "");
    return path.join(this.rootDir, "objects", safe);
  }

  private etagPath(key: string): string {
    return `${this.objectPath(key)}.etag`;
  }

  private async atomicWrite(file: string, data: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, data, "utf8");
    await rename(tmp, file);
  }

  async get(key: string): Promise<ObjectBody | null> {
    const file = this.objectPath(key);
    try {
      const body = await readFile(file, "utf8");
      let etag: string | null = null;
      try {
        etag = (await readFile(this.etagPath(key), "utf8")).trim() || null;
      } catch {
        etag = null;
      }
      return { body, etag };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async put(key: string, body: string, options: PutObjectOptions = {}): Promise<void> {
    const current = await this.get(key);
    if (!options.unconditional) {
      if (options.ifNoneMatch && current) throw new StorePreconditionError(key);
      if (options.ifMatch !== undefined && current?.etag !== options.ifMatch) {
        throw new StorePreconditionError(key);
      }
      if (options.ifMatch !== undefined && !current) throw new StorePreconditionError(key);
    }
    const etag = `"file-${randomUUID()}"`;
    await this.atomicWrite(this.objectPath(key), body);
    await this.atomicWrite(this.etagPath(key), etag);
  }

  /** Playwright: wipe the scratch tree. */
  async reset(): Promise<void> {
    await rm(path.join(this.rootDir, "objects"), { recursive: true, force: true });
  }
}
