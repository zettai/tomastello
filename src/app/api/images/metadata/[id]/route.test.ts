import { PUT } from "./route";
import { updateImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";
import { ConflictError } from "@/lib/jsonStore";

// Mock dependencies
jest.mock("@/lib/metadata", () => ({
  updateImageMetadata: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

describe("PUT /api/images/metadata/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if no auth token", async () => {
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
      json: jest.fn().mockResolvedValue({}),
    };

    const response = await PUT(request as any);
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
    };

    const response = await PUT(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if image ID is missing", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({}),
    };

    const response = await PUT(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Image ID is required" });
  });

  it("returns 404 if image not found", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateImageMetadata as jest.Mock).mockResolvedValueOnce(null);

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ id: "123" }),
    };

    const response = await PUT(request as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: "Image not found" });
  });

  it("updates metadata successfully", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateImageMetadata as jest.Mock).mockResolvedValueOnce({
      id: "123",
      fileName: "test.jpg",
      url: "https://example.com/test.jpg",
      size: 1000,
      type: "image/jpeg",
      uploadedBy: "test@example.com",
    });

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ id: "123" }),
    };

    const response = await PUT(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      metadata: {
        id: "123",
        fileName: "test.jpg",
        url: "https://example.com/test.jpg",
        size: 1000,
        type: "image/jpeg",
        uploadedBy: "test@example.com",
      },
    });

    expect(updateImageMetadata).toHaveBeenCalled();
  });

  it("handles metadata update errors", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateImageMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("Update failed")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ id: "123" }),
    };

    const response = await PUT(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to update metadata" });
  });

  it("should return 409 when another save collides", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (updateImageMetadata as jest.Mock).mockRejectedValueOnce(
      new ConflictError("metadata/test.json")
    );

    const request = {
      cookies: {
        get: jest.fn().mockReturnValue({ value: "valid-token" }),
      },
      json: jest.fn().mockResolvedValue({ id: "123" }),
    };

    const response = await PUT(request as any);
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});
