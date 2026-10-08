import { TextEncoder, TextDecoder } from "util";

describe("setup", () => {
  it("should have TextEncoder and TextDecoder globally available", () => {
    expect(global.TextEncoder).toBe(TextEncoder);
    expect(global.TextDecoder).toBe(TextDecoder);
  });

  it("should encode and decode text correctly", () => {
    const text = "Hello, World!";
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const encoded = encoder.encode(text);
    const decoded = decoder.decode(encoded);

    expect(decoded).toBe(text);
  });
});
