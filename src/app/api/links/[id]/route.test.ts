import { PUT } from "./route";
import { updateLinkMetadata } from "@/lib/links";
import { verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";
import { ConflictError } from "@/lib/jsonStore";

// Mock dependencies
jest.mock("@/lib/links", () => ({
  updateLinkMetadata: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

describe("PUT /api/links/[id]", () => {
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

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
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

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
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
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Link ID is required" });
  });

  it("returns 400 if text is empty", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: "" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Text cannot be empty" });
  });

  it("returns 400 if href is empty", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ href: "" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Href cannot be empty" });
  });

  it("returns 400 if text is not a string", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: 123 }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Text must be a string" });
  });

  it("returns 400 if href is not a string", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ href: 123 }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Href must be a string" });
  });

  it("returns 404 if link not found", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateLinkMetadata as jest.Mock).mockResolvedValueOnce(null);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: "Updated Link" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "999" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: "Link not found" });
  });

  it("updates link successfully", async () => {
    const mockUpdatedLink = {
      id: "1",
      text: "Updated Link",
      href: "https://updated.com",
      description: "Updated description",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "test@example.com",
    };

    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateLinkMetadata as jest.Mock).mockResolvedValueOnce(mockUpdatedLink);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({
        text: "Updated Link",
        href: "https://updated.com",
        description: "Updated description",
      }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, link: mockUpdatedLink });
  });

  it("handles errors when updating link", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateLinkMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("Failed to update link")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: "Updated Link" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: "Failed to update link",
      success: false,
    });
  });

  it("should return 409 when another save collides", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateLinkMetadata as jest.Mock).mockRejectedValueOnce(
      new ConflictError("metadata/test.json")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: "Updated Link" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });

  it("allows updating only text", async () => {
    const mockUpdatedLink = {
      id: "1",
      text: "Updated Text Only",
      href: "https://example.com",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "test@example.com",
    };

    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateLinkMetadata as jest.Mock).mockResolvedValueOnce(mockUpdatedLink);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ text: "Updated Text Only" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, link: mockUpdatedLink });
  });

  it("allows updating only href", async () => {
    const mockUpdatedLink = {
      id: "1",
      text: "Test Link",
      href: "https://newhref.com",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "test@example.com",
    };

    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateLinkMetadata as jest.Mock).mockResolvedValueOnce(mockUpdatedLink);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ href: "https://newhref.com" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, link: mockUpdatedLink });
  });

  it("allows updating only description", async () => {
    const mockUpdatedLink = {
      id: "1",
      text: "Test Link",
      href: "https://example.com",
      description: "New description only",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "test@example.com",
    };

    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateLinkMetadata as jest.Mock).mockResolvedValueOnce(mockUpdatedLink);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ description: "New description only" }),
    } as unknown as NextRequest;

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, link: mockUpdatedLink });
  });
});
