/**
 * @jest-environment node
 *
 * Real site/links/jsonStore stack: store that ignores If-Match must still 409
 * when the client sends a stale If-Match (app-side head pre-check).
 */
import { PUT } from "./route";
import { verifyToken } from "@/lib/auth";
import { setObjectStoreForTests } from "@/lib/store";
import type { ObjectStore } from "@/lib/store/types";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/cdn", () => ({
  purgePublicPages: jest.fn().mockResolvedValue("skipped"),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("PUT /api/site ETag pre-check", () => {
  afterEach(() => {
    setObjectStoreForTests(undefined);
  });

  it("should return 409 when the store ignores If-Match but head reports a different ETag", async () => {
    const siteBody = JSON.stringify(
      { about: { content: "live" }, photos: [] },
      null,
      2
    );
    const linksBody = JSON.stringify([], null, 2);
    const objects = new Map<string, { body: string; etag: string }>([
      ["metadata/site.json", { body: siteBody, etag: '"site-live"' }],
      ["metadata/links.json", { body: linksBody, etag: '"links-live"' }],
    ]);

    const put = jest.fn(async (key: string, body: string) => {
      objects.set(key, { body, etag: `"written-${key}"` });
    });

    const store: ObjectStore = {
      get: async (key) => {
        const entry = objects.get(key);
        return entry ? { body: entry.body, etag: entry.etag } : null;
      },
      head: async (key) => {
        const entry = objects.get(key);
        return entry ? { etag: entry.etag } : null;
      },
      put,
    };
    setObjectStoreForTests(store);

    (verifyToken as jest.Mock).mockResolvedValueOnce({ email: "test@example.com" });

    const request = {
      cookies: { get: jest.fn().mockReturnValue({ value: "valid-token" }) },
      headers: {
        get: (name: string) => {
          const n = name.toLowerCase();
          if (n === "if-match") return '"bogus-site"';
          if (n === "x-links-if-match") return '"links-live"';
          return null;
        },
      },
      json: jest.fn().mockResolvedValue({
        about: { content: "live" },
        photos: [],
        links: [],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    expect(response.status).toBe(409);
    expect(put).not.toHaveBeenCalled();
  });
});
