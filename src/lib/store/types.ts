export class StorePreconditionError extends Error {
  constructor(readonly key: string) {
    super(`${key} precondition failed`);
    this.name = "StorePreconditionError";
  }
}

export class StoreNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreNotImplementedError";
  }
}

export type ObjectBody = {
  body: string;
  etag: string | null;
};

export type PutObjectOptions = {
  contentType?: string;
  /** When set, write only if the stored ETag matches (S3 If-Match). */
  ifMatch?: string;
  /** When true, write only if the object does not exist (S3 If-None-Match: *). */
  ifNoneMatch?: boolean;
  /** Skip conditional headers (admin whole-document saves). */
  unconditional?: boolean;
};

export interface ObjectStore {
  get(key: string): Promise<ObjectBody | null>;
  put(key: string, body: string, options?: PutObjectOptions): Promise<void>;
}
