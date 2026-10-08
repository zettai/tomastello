import { GET, POST, DELETE } from "./route";
import {
  getLinkMetadata,
  addLinkMetadata,
  deleteLinkMetadata,
} from "@/lib/links";
import { verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";
import { ConflictError } from "@/lib/jsonStore";

// Mock dependencies
jest.mock("@/lib/links", () => ({
  getLinkMetadata: jest.fn(),
  addLinkMetadata: jest.fn(),
  deleteLinkMetadata: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

function getRequest(url: string, token?: string) {
  // jest.setup.ts mocks next/server, so build the request the way the route reads it
  return {
    url: url,
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
  } as unknown as NextRequest;
}

describe("GET /api/links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns links successfully", async () => {
    const mockLinks = [
      {
        id: "1",
        text: "Test Link",
        href: "https://example.com",
        createdAt: "2024-01-01T00:00:00.000Z",
        createdBy: "test@example.com",
      },
    ];
    (getLinkMetadata as jest.Mock).mockResolvedValueOnce(mockLinks);
    (verifyToken as jest.Mock).mockResolvedValueOnce({ id: "1", email: "test@example.com" });

    const response = await GET(getRequest("http://localhost/api/links", "valid"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, links: mockLinks });
  });

  it("hides the creator email from the public", async () => {
    (getLinkMetadata as jest.Mock).mockResolvedValueOnce([
      {
        id: "1",
        text: "Test Link",
        href: "https://example.com",
        description: "d",
        createdAt: "2024-01-01T00:00:00.000Z",
        createdBy: "test@example.com",
      },
    ]);

    const response = await GET(getRequest("http://localhost/api/links"));
    const data = await response.json();

    expect(data.links).toEqual([
      {
        id: "1",
        text: "Test Link",
        href: "https://example.com",
        description: "d",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("handles errors when getting links", async () => {
    (getLinkMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to get links")
    );

    const response = await GET(getRequest("http://localhost/api/links"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: "Failed to retrieve links",
      success: false,
    });
  });
});

describe("POST /api/links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if no auth token", async () => {
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await POST(request);
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

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if text is missing", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ href: "https://example.com" }),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Text and href are required" });
  });

  it("returns 400 if href is missing", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: "Test Link" }),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Text and href are required" });
  });

  it("returns 400 if text is not a string", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest
        .fn()
        .mockResolvedValue({ text: 123, href: "https://example.com" }),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Text and href must be strings" });
  });

  it("returns 400 if href is not a string", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: "Test Link", href: 123 }),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Text and href must be strings" });
  });

  it("creates link successfully", async () => {
    const mockLink = {
      id: "1",
      text: "Test Link",
      href: "https://example.com",
      description: "Test description",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "test@example.com",
    };

    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (addLinkMetadata as jest.Mock).mockResolvedValueOnce(mockLink);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({
        text: "Test Link",
        href: "https://example.com",
        description: "Test description",
      }),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, link: mockLink });
  });

  it("handles errors when creating link", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (addLinkMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to create link")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({
        text: "Test Link",
        href: "https://example.com",
      }),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: "Failed to create link",
      success: false,
    });
  });

  it("should return 409 when another save collides", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (addLinkMetadata as jest.Mock).mockRejectedValueOnce(
      new ConflictError("metadata/test.json")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({
        text: "Test Link",
        href: "https://example.com",
      }),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});

describe("DELETE /api/links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if no auth token", async () => {
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue("1"),
        },
      },
    } as unknown as NextRequest;

    const response = await DELETE(request);
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
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue("1"),
        },
      },
    } as unknown as NextRequest;

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if id is missing", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue(null),
        },
      },
    } as unknown as NextRequest;

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Link ID is required" });
  });

  it("returns 404 if link not found", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (deleteLinkMetadata as jest.Mock).mockResolvedValueOnce(false);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue("999"),
        },
      },
    } as unknown as NextRequest;

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: "Link not found" });
  });

  it("deletes link successfully", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (deleteLinkMetadata as jest.Mock).mockResolvedValueOnce(true);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue("1"),
        },
      },
    } as unknown as NextRequest;

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it("handles errors when deleting link", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (deleteLinkMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to delete link")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue("1"),
        },
      },
    } as unknown as NextRequest;

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: "Failed to delete link",
      success: false,
    });
  });
});
