import { TextEncoder, TextDecoder } from "node:util";
import { deserialize, serialize } from "node:v8";

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;

if (!globalThis.structuredClone) {
  globalThis.structuredClone = <T>(value: T): T => deserialize(serialize(value));
}
