import { normalizeLinkUrl } from "./normalizeUrl";

describe("normalizeLinkUrl", () => {
  it("should prefix https when the value is a bare domain", () => {
    expect(normalizeLinkUrl("bandcamp.com/tomas")).toBe(
      "https://bandcamp.com/tomas"
    );
  });

  it("should leave an https URL unchanged aside from URL normalization", () => {
    expect(normalizeLinkUrl("https://example.com/x")).toBe(
      "https://example.com/x"
    );
  });

  it("should return null for empty input", () => {
    expect(normalizeLinkUrl("   ")).toBeNull();
  });

  it("should return null for non-http schemes", () => {
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
  });
});
