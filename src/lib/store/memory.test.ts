/**
 * @jest-environment node
 */
import { MemoryObjectStore } from "./memory";
import { StorePreconditionError } from "./types";

describe("MemoryObjectStore", () => {
  it("supports conditional create and update", async () => {
    const store = new MemoryObjectStore();
    await store.put("a", "{}", { ifNoneMatch: true });
    await expect(store.put("a", "{}", { ifNoneMatch: true })).rejects.toBeInstanceOf(StorePreconditionError);
    const first = await store.get("a");
    await store.put("a", '{"v":2}', { ifMatch: first!.etag! });
    await expect(store.get("a")).resolves.toMatchObject({ body: '{"v":2}' });
  });
});
