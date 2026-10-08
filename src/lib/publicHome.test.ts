/**
 * @jest-environment node
 */
import { computeContentVersion } from "@/lib/publicHome";
import type { LinkMetadata } from "@/types/link";
import type { SiteData } from "@/types/site";

describe("computeContentVersion", () => {
  const link = (createdAt: string): LinkMetadata => ({
    id: "1",
    text: "t",
    href: "https://example.com",
    createdAt,
    createdBy: "a@b.co",
  });

  it("uses the latest site or link timestamp", () => {
    const site: SiteData = {
      about: { content: "" },
      photos: [],
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    expect(computeContentVersion(site, [link("2026-01-01T00:00:00.000Z")])).toBe("2026-01-02T00:00:00.000Z");
    expect(computeContentVersion(site, [link("2026-06-01T00:00:00.000Z")])).toBe("2026-06-01T00:00:00.000Z");
  });

  it("returns 0 when no timestamps exist", () => {
    expect(computeContentVersion({ about: { content: "" }, photos: [] }, [])).toBe("0");
  });
});
