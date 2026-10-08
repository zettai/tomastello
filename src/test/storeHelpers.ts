import { setObjectStoreForTests } from "@/lib/store";
import { MemoryObjectStore } from "@/lib/store/memory";

let currentStore: MemoryObjectStore;

export function resetTestObjectStore(): MemoryObjectStore {
  currentStore = new MemoryObjectStore();
  process.env.TOMASTELLO_STORE = "memory";
  setObjectStoreForTests(currentStore);
  return currentStore;
}

export function getTestObjectStore(): MemoryObjectStore {
  return currentStore ?? resetTestObjectStore();
}

export async function seedJson(key: string, data: unknown): Promise<void> {
  await getTestObjectStore().put(key, JSON.stringify(data), { unconditional: true });
}

export async function readStoredJson<T>(key: string): Promise<T> {
  const res = await getTestObjectStore().get(key);
  if (!res?.body) {
    throw new Error(`Expected JSON at ${key}`);
  }
  return JSON.parse(res.body) as T;
}
