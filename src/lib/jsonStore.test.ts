/**
 * @jest-environment node
 */
import { MemoryObjectStore, setObjectStoreForTests } from "./store";
import type { ObjectStore, PutObjectOptions } from "./store/types";
import { StoreNotImplementedError, StorePreconditionError } from "./store/types";
import {
  backoffMs,
  ConflictError,
  readJson,
  resetConditionalWriteSupportForTests,
  updateJson,
  writeJson,
} from "./jsonStore";

describe("jsonStore", () => {
  let store: MemoryObjectStore;

  beforeEach(() => {
    store = new MemoryObjectStore();
    setObjectStoreForTests(store);
    resetConditionalWriteSupportForTests();
  });

  describe("readJson", () => {
    it("should return the document and its ETag", async () => {
      await store.put("k", JSON.stringify([1, 2]), { contentType: "application/json", unconditional: true });
      await expect(readJson("k", [])).resolves.toEqual({ data: [1, 2], etag: expect.any(String) });
    });

    it("should return the fallback with a null ETag when the object doesn't exist", async () => {
      await expect(readJson("k", [])).resolves.toEqual({ data: [], etag: null });
    });
  });

  describe("writeJson", () => {
    it("should write only if the ETag still matches", async () => {
      await store.put("k", JSON.stringify([1]), { contentType: "application/json", unconditional: true });
      const { etag } = await readJson("k", []);
      await writeJson("k", [2], etag);
      await expect(readJson("k", [])).resolves.toEqual({ data: [2], etag: expect.not.stringMatching(etag!) });
    });

    it("should throw ConflictError when the ETag changed", async () => {
      await store.put("k", JSON.stringify([1]), { contentType: "application/json", unconditional: true });
      const { etag } = await readJson("k", []);
      await store.put("k", JSON.stringify([9]), { contentType: "application/json", unconditional: true });
      await expect(writeJson("k", [2], etag)).rejects.toBeInstanceOf(ConflictError);
    });

    it("should use If-None-Match when creating", async () => {
      await writeJson("k", { a: 1 }, null);
      await expect(readJson("k", {})).resolves.toEqual({ data: { a: 1 }, etag: expect.any(String) });
      await expect(writeJson("k", { a: 2 }, null)).rejects.toBeInstanceOf(ConflictError);
    });

    it("should throw ConflictError without PUT when expectedEtag mismatches", async () => {
      await store.put("k", JSON.stringify([1]), { contentType: "application/json", unconditional: true });
      const put = jest.spyOn(store, "put");
      await expect(writeJson("k", [2], '"bogus"')).rejects.toBeInstanceOf(ConflictError);
      expect(put).not.toHaveBeenCalled();
    });

    it("should PUT when expectedEtag matches", async () => {
      await store.put("k", JSON.stringify([1]), { contentType: "application/json", unconditional: true });
      const { etag } = await readJson("k", []);
      const put = jest.spyOn(store, "put");
      await writeJson("k", [2], etag);
      expect(put).toHaveBeenCalledWith(
        "k",
        expect.any(String),
        expect.objectContaining({ ifMatch: etag })
      );
    });

    it("should throw ConflictError without PUT when creating but the object exists", async () => {
      await store.put("k", JSON.stringify([1]), { contentType: "application/json", unconditional: true });
      const put = jest.spyOn(store, "put");
      await expect(writeJson("k", [2], null)).rejects.toBeInstanceOf(ConflictError);
      expect(put).not.toHaveBeenCalled();
    });

    it("should reject via pre-check when the store ignores If-Match", async () => {
      let etag = '"real-1"';
      let body = JSON.stringify([1]);
      const put = jest.fn(async (_key: string, next: string) => {
        body = next;
        etag = '"real-2"';
      });
      const ignoringStore: ObjectStore = {
        get: async () => ({ body, etag }),
        head: async () => ({ etag }),
        put,
      };
      setObjectStoreForTests(ignoringStore);
      await expect(writeJson("k", [2], '"bogus"')).rejects.toBeInstanceOf(ConflictError);
      expect(put).not.toHaveBeenCalled();
    });

    it("should pre-check before unconditional PUT when conditional writes are unsupported", async () => {
      let etag = '"real-1"';
      let body = JSON.stringify([1]);
      const put = jest.fn(async (key: string, next: string, options?: PutObjectOptions) => {
        if (!options?.unconditional) {
          throw new StoreNotImplementedError("conditional writes");
        }
        body = next;
        etag = '"real-2"';
      });
      setObjectStoreForTests({
        get: async () => ({ body, etag }),
        head: async () => ({ etag }),
        put,
      });
      await expect(writeJson("k", [2], '"bogus"')).rejects.toBeInstanceOf(ConflictError);
      expect(put).not.toHaveBeenCalled();

      resetConditionalWriteSupportForTests();
      etag = '"real-1"';
      await writeJson("k", [2], '"real-1"');
      expect(put).toHaveBeenCalled();
    });
  });

  describe("updateJson", () => {
    it("should retry on conflict and succeed", async () => {
      const result = await updateJson("k", [] as number[], (current) => [...current, 1], {
        wait: async () => undefined,
      });
      expect(result).toEqual([1]);
    });

    it("should throw after MAX_ATTEMPTS conflicts", async () => {
      setObjectStoreForTests({
        get: async () => ({ body: "[]", etag: '"stale"' }),
        head: async () => ({ etag: '"fresh"' }),
        put: async () => {
          throw new StorePreconditionError("k");
        },
      });
      await expect(updateJson("k", [] as number[], () => [1])).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("backoffMs", () => {
    it("should stay within the jitter window", () => {
      expect(backoffMs(0, () => 0)).toBe(0);
      expect(backoffMs(2, () => 0.5)).toBe(50);
    });
  });
});
