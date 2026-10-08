import { GET, PUT } from "./route";
import { purgePublicPages } from "@/lib/cdn";
import { getSiteData, saveSiteData } from "@/lib/site";
import { verifyToken } from "@/lib/auth";
import { getLinkMetadata, saveLinkMetadata } from "@/lib/links";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import type { LinkMetadata } from "@/types/link";

// Mock dependencies
jest.mock("@/lib/site", () => ({
  getSiteData: jest.fn(),
  saveSiteData: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/links", () => ({
  getLinkMetadata: jest.fn(),
  saveLinkMetadata: jest.fn(),
}));

jest.mock("@/lib/cdn", () => ({
  purgePublicPages: jest.fn().mockResolvedValue("skipped"),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

function getRequest(url: string, token?: string) {
  // jest.setup.ts mocks next/server, so build the request the way the route reads it
  return {
    url: url,
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
  } as unknown as NextRequest;
}

describe("GET /api/site", () => {
  it("returns site data successfully", async () => {
    const mockData = { about: { content: "Test content" }, photos: [] };
    const mockLinks: LinkMetadata[] = [];
    (getSiteData as jest.Mock).mockResolvedValueOnce(mockData);
    (getLinkMetadata as jest.Mock).mockResolvedValueOnce(mockLinks);

    const response = await GET(getRequest("http://localhost/api/site"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ...mockData, links: mockLinks });
  });

  it("hides link creator emails from the public, shows them to admins", async () => {
    const link: LinkMetadata = {
      id: "1",
      text: "Link",
      href: "https://example.com",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "admin@test.com",
    };
    (getSiteData as jest.Mock).mockResolvedValue({ about: { content: "" }, photos: [] });
    (getLinkMetadata as jest.Mock).mockResolvedValue([link]);

    const publicData = await (await GET(getRequest("http://localhost/api/site"))).json();
    expect(publicData.links[0]).not.toHaveProperty("createdBy");

    (verifyToken as jest.Mock).mockResolvedValueOnce({ id: "1", email: "admin@test.com" });
    const adminData = await (await GET(getRequest("http://localhost/api/site", "valid"))).json();
    expect(adminData.links[0].createdBy).toBe("admin@test.com");
  });

  it("handles errors when getting site data", async () => {
    (getSiteData as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to get site data")
    );

    const response = await GET(getRequest("http://localhost/api/site"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to get site data" });
  });
});

describe("PUT /api/site", () => {
  it("returns 401 if no auth token", async () => {
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce(null);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "invalid-token" }),
      },
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if about content is too long", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest
        .fn()
        .mockResolvedValue({ about: { content: "a".repeat(2001) } }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: "About content must be 2000 characters or less",
    });
  });

  it("returns 400 if photos is not an array", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ photos: "not an array" }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Photos must be an array" });
  });

  it("returns 400 if a photo is missing id or url", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ photos: [{ id: "1" }] }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Each photo must have id and url" });
  });

  it("updates site data successfully", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (saveSiteData as jest.Mock).mockResolvedValueOnce(undefined);
    (saveLinkMetadata as jest.Mock).mockResolvedValueOnce(undefined);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({
        about: { content: "Test content" },
        photos: [{ id: "1", url: "https://example.com/photo1.jpg" }],
      }),
    } as unknown as NextRequest;

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      about: { content: "Test content" },
      photos: [{ id: "1", url: "https://example.com/photo1.jpg" }],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(purgePublicPages).toHaveBeenCalled();
  });

  it("handles errors when updating site data", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (saveSiteData as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to update site data")
    );
    (saveLinkMetadata as jest.Mock).mockResolvedValueOnce(undefined);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
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
