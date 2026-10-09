import { DELETE } from "./route";
import { scalewayClient } from "@/lib/api";
import { purgePublicPages } from "@/lib/cdn";
import { getMetadataByFileName, deleteImageMetadata } from "@/lib/metadata";
import { removeSitePhotoByKey } from "@/lib/site";
import { verifyToken } from "@/lib/auth";
import { ConflictError } from "@/lib/jsonStore";

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

// Minimal mocks for NextRequest and RequestCookies
class MockRequestCookies {
  constructor(private cookies: Record<string, string> = {}) {}
  get(name: string) {
    if (name === "auth-token" && this.cookies[name]) {
      return { value: this.cookies[name] };
    }
    return undefined;
  }
}
class MockNextRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  cookies: MockRequestCookies;
  constructor(
    url: string,
    { method, headers }: { method: string; headers?: Record<string, string> }
  ) {
    this.url = url;
    this.method = method;
    this.headers = headers || {};
    // Parse cookies from headers.cookie
    const cookieObj: Record<string, string> = {};
    if (this.headers.cookie) {
      this.headers.cookie.split(";").forEach((c: string) => {
        const [k, v] = c.trim().split("=");
        cookieObj[k] = v;
      });
    }
    this.cookies = new MockRequestCookies(cookieObj);
  }
}

// Mock dependencies
jest.mock("@/lib/api", () => ({
  scalewayClient: {
    send: jest.fn(),
  },
  SCALEWAY_BUCKET: "test-bucket",
}));

jest.mock("@/lib/metadata", () => ({
  getMetadataByFileName: jest.fn(),
  deleteImageMetadata: jest.fn(),
}));

jest.mock("@/lib/site", () => ({
  removeSitePhotoByKey: jest.fn(),
}));

jest.mock("@/lib/cdn", () => ({
  purgePublicPages: jest.fn(),
}));

describe("DELETE /api/images/delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if no auth token", async () => {
    const request = new MockNextRequest(
      "http://localhost:3000/api/images/delete",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce(null);

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/delete",
      {
        method: "DELETE",
        headers: {
          cookie: "auth-token=invalid-token",
        },
      }
    );

    const response = await DELETE(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if no key provided", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/delete",
      {
        method: "DELETE",
        headers: {
          cookie: "auth-token=valid-token",
        },
      }
    );

    const response = await DELETE(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Image key is required" });
  });

  it("successfully deletes image with metadata", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (getMetadataByFileName as jest.Mock).mockResolvedValueOnce({
      id: "test-id",
      fileName: "test.jpg",
    });
    (deleteImageMetadata as jest.Mock).mockResolvedValueOnce({});
    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (removeSitePhotoByKey as jest.Mock).mockResolvedValueOnce(true);
    (purgePublicPages as jest.Mock).mockResolvedValueOnce(undefined);

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/delete?key=test.jpg",
      {
        method: "DELETE",
        headers: {
          cookie: "auth-token=valid-token",
        },
      }
    );

    const response = await DELETE(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      message: "Image and metadata deleted successfully",
    });

    expect(getMetadataByFileName).toHaveBeenCalledWith("test.jpg");
    expect(deleteImageMetadata).toHaveBeenCalledWith("test-id");
    expect(removeSitePhotoByKey).toHaveBeenCalledWith("test.jpg");
    expect(purgePublicPages).toHaveBeenCalled();
    expect(scalewayClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "test.jpg",
        },
      })
    );
  });

  it("successfully deletes image without metadata", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (getMetadataByFileName as jest.Mock).mockResolvedValueOnce(null);
    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (removeSitePhotoByKey as jest.Mock).mockResolvedValueOnce(false);
    (purgePublicPages as jest.Mock).mockResolvedValueOnce(undefined);

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/delete?key=test.jpg",
      {
        method: "DELETE",
        headers: {
          cookie: "auth-token=valid-token",
        },
      }
    );

    const response = await DELETE(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      message: "Image and metadata deleted successfully",
    });

    expect(getMetadataByFileName).toHaveBeenCalledWith("test.jpg");
    expect(deleteImageMetadata).not.toHaveBeenCalled();
    expect(removeSitePhotoByKey).toHaveBeenCalledWith("test.jpg");
    expect(purgePublicPages).toHaveBeenCalled();
    expect(scalewayClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Key: "test.jpg",
        },
      })
    );
  });

  it("handles delete errors", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (getMetadataByFileName as jest.Mock).mockResolvedValueOnce({
      id: "test-id",
      fileName: "test.jpg",
    });
    (scalewayClient.send as jest.Mock).mockRejectedValueOnce(
      new Error("Delete failed")
    );

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/delete?key=test.jpg",
      {
        method: "DELETE",
        headers: {
          cookie: "auth-token=valid-token",
        },
      }
    );

    const response = await DELETE(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to delete image" });
  });

  it("should return 409 when another save collides", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (getMetadataByFileName as jest.Mock).mockResolvedValueOnce({
      id: "test-id",
      fileName: "test.jpg",
    });
    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (deleteImageMetadata as jest.Mock).mockRejectedValueOnce(new ConflictError("metadata/test.json"));

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/delete?key=test.jpg",
      {
        method: "DELETE",
        headers: {
          cookie: "auth-token=valid-token",
        },
      }
    );

    const response = await DELETE(request as any);
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});
