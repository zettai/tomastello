import { GET, PUT } from "./route";
import { purgePublicPages } from "@/lib/cdn";
import { readSiteData, saveSiteData } from "@/lib/site";
import { verifyToken } from "@/lib/auth";
import { readLinkMetadata, saveLinkMetadata } from "@/lib/links";
import { ConflictError } from "@/lib/jsonStore";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import type { LinkMetadata } from "@/types/link";

jest.mock("@/lib/site", () => ({
  readSiteData: jest.fn(),
  saveSiteData: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/links", () => ({
  readLinkMetadata: jest.fn(),
  saveLinkMetadata: jest.fn(),
}));

jest.mock("@/lib/cdn", () => ({
  purgePublicPages: jest.fn().mockResolvedValue("skipped"),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

function getRequest(url: string, token?: string) {
  return {
    url: url,
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
    headers: { get: () => null },
  } as unknown as NextRequest;
}

describe("GET /api/site", () => {
  it("returns site data successfully", async () => {
    const mockData = { about: { content: "Test content" }, photos: [] };
    const mockLinks: LinkMetadata[] = [];
    (readSiteData as jest.Mock).mockResolvedValueOnce({ data: mockData, etag: '"site-1"' });
    (readLinkMetadata as jest.Mock).mockResolvedValueOnce({ data: mockLinks, etag: '"links-1"' });

    const response = await GET(getRequest("http://localhost/api/site"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ...mockData, links: mockLinks });
    expect(response.headers.get("ETag")).toBe('"site-1"');
    expect(response.headers.get("X-Links-ETag")).toBe('"links-1"');
  });

  it("strips createdBy for unauthenticated requests", async () => {
    const mockLinks: LinkMetadata[] = [
      {
        id: "1",
        text: "A",
        href: "https://a.com",
        createdAt: "2024-01-01",
        createdBy: "admin@example.com",
      },
    ];
    (readSiteData as jest.Mock).mockResolvedValue({
      data: { about: { content: "" }, photos: [] },
      etag: null,
    });
    (readLinkMetadata as jest.Mock).mockResolvedValue({ data: mockLinks, etag: null });
    (verifyToken as jest.Mock).mockResolvedValueOnce(null);

    const response = await GET(getRequest("http://localhost/api/site", "bad"));
    const data = await response.json();
    expect(data.links[0].createdBy).toBeUndefined();
  });

  it("handles get errors", async () => {
    (readSiteData as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to get site data")
    );

    const response = await GET(getRequest("http://localhost/api/site"));
    expect(response.status).toBe(500);
  });
});

describe("PUT /api/site", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    const request = {
      cookies: { get: jest.fn().mockReturnValue(undefined) },
      headers: { get: () => null },
      json: jest.fn(),
    } as unknown as NextRequest;

    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it("rejects invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce(null);
    const request = {
      cookies: { get: jest.fn().mockReturnValue({ value: "bad" }) },
      headers: { get: () => null },
      json: jest.fn(),
    } as unknown as NextRequest;

    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it("rejects about content over 2000 chars", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({ email: "a@b.com" });
    const request = {
      cookies: { get: jest.fn().mockReturnValue({ value: "tok" }) },
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        about: { content: "x".repeat(2001) },
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("rejects invalid photos", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({ email: "a@b.com" });
    const request = {
      cookies: { get: jest.fn().mockReturnValue({ value: "tok" }) },
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        about: { content: "ok" },
        photos: [{ id: "1" }],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("rejects invalid links", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({ email: "a@b.com" });
    const request = {
      cookies: { get: jest.fn().mockReturnValue({ value: "tok" }) },
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        about: { content: "ok" },
        links: [{ text: "x" }],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("updates site data successfully", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (readSiteData as jest.Mock).mockResolvedValueOnce({
      data: { about: { content: "" }, photos: [] },
      etag: '"site-1"',
    });
    (readLinkMetadata as jest.Mock).mockResolvedValueOnce({
      data: [],
      etag: '"links-1"',
    });
    (saveSiteData as jest.Mock).mockResolvedValueOnce(undefined);
    (saveLinkMetadata as jest.Mock).mockResolvedValueOnce(undefined);

    const headers = new Map<string, string>([
      ["If-Match", '"site-1"'],
      ["X-Links-If-Match", '"links-1"'],
    ]);
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      headers: { get: (name: string) => headers.get(name) ?? null },
      json: jest.fn().mockResolvedValue({
        about: { content: "Test content" },
        photos: [{ id: "1", url: "https://example.com/photo1.jpg" }],
        links: [],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.about.content).toBe("Test content");
    expect(saveSiteData).toHaveBeenCalledWith(
      expect.objectContaining({ about: { content: "Test content" } }),
      '"site-1"'
    );
    expect(saveLinkMetadata).toHaveBeenCalledWith([], '"links-1"');
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(purgePublicPages).toHaveBeenCalled();
  });

  it("should return 409 when If-Match site ETag does not match before write", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (readSiteData as jest.Mock).mockResolvedValueOnce({
      data: { about: { content: "" }, photos: [] },
      etag: '"current-site"',
    });
    (readLinkMetadata as jest.Mock).mockResolvedValueOnce({
      data: [],
      etag: '"links-1"',
    });

    const headers = new Map<string, string>([
      ["If-Match", '"stale-site"'],
      ["X-Links-If-Match", '"links-1"'],
    ]);
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      headers: { get: (name: string) => headers.get(name) ?? null },
      json: jest.fn().mockResolvedValue({
        about: { content: "Test content" },
        photos: [],
        links: [],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toMatch(/Someone else saved/i);
    expect(saveSiteData).not.toHaveBeenCalled();
    expect(saveLinkMetadata).not.toHaveBeenCalled();
  });

  it("should return 409 when X-Links-If-Match does not match before write", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (readSiteData as jest.Mock).mockResolvedValueOnce({
      data: { about: { content: "" }, photos: [] },
      etag: '"site-1"',
    });
    (readLinkMetadata as jest.Mock).mockResolvedValueOnce({
      data: [],
      etag: '"current-links"',
    });

    const headers = new Map<string, string>([
      ["If-Match", '"site-1"'],
      ["X-Links-If-Match", '"stale-links"'],
    ]);
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      headers: { get: (name: string) => headers.get(name) ?? null },
      json: jest.fn().mockResolvedValue({
        about: { content: "Test content" },
        photos: [],
        links: [],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toMatch(/Someone else saved/i);
    expect(saveSiteData).not.toHaveBeenCalled();
    expect(saveLinkMetadata).not.toHaveBeenCalled();
  });

  it("should return links-saved-partial message when links conflict after site write", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (readSiteData as jest.Mock).mockResolvedValueOnce({
      data: { about: { content: "" }, photos: [] },
      etag: '"site-1"',
    });
    (readLinkMetadata as jest.Mock).mockResolvedValueOnce({
      data: [],
      etag: '"links-1"',
    });
    (saveSiteData as jest.Mock).mockResolvedValueOnce(undefined);
    (saveLinkMetadata as jest.Mock).mockRejectedValueOnce(
      new ConflictError("metadata/links.json")
    );

    const headers = new Map<string, string>([
      ["If-Match", '"site-1"'],
      ["X-Links-If-Match", '"links-1"'],
    ]);
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      headers: { get: (name: string) => headers.get(name) ?? null },
      json: jest.fn().mockResolvedValue({
        about: { content: "Test content" },
        photos: [],
        links: [],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toMatch(
      /Site settings were saved, but links were not/i
    );
    expect(saveSiteData).toHaveBeenCalled();
  });

  it("returns 409 when site save conflicts", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (readSiteData as jest.Mock).mockResolvedValueOnce({
      data: { about: { content: "" }, photos: [] },
      etag: null,
    });
    (readLinkMetadata as jest.Mock).mockResolvedValueOnce({
      data: [],
      etag: null,
    });
    (saveSiteData as jest.Mock).mockRejectedValueOnce(
      new ConflictError("metadata/site.json")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        about: { content: "Test content" },
        photos: [],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toMatch(/Someone else saved/i);
  });

  it("handles errors when updating site data", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (readSiteData as jest.Mock).mockResolvedValueOnce({
      data: { about: { content: "" }, photos: [] },
      etag: null,
    });
    (readLinkMetadata as jest.Mock).mockResolvedValueOnce({
      data: [],
      etag: null,
    });
    (saveSiteData as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to update site data")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        about: { content: "Test content" },
        photos: [{ id: "1", url: "https://example.com/photo1.jpg" }],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to update site data" });
  });
});
