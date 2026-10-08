import { GET } from "./route";
import { getImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";

// Minimal mocks for NextRequest and RequestCookies
class MockRequestCookies {
  constructor(private cookies: Record<string, string> = {}) {}
  get(name: string) {
    if (this.cookies[name]) {
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
jest.mock("@/lib/metadata", () => ({
  getImageMetadata: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

describe("GET /api/images/metadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if no auth token", async () => {
    const request = new MockNextRequest(
      "http://localhost:3000/api/images/metadata",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce(null);

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/metadata",
      {
        method: "GET",
        headers: {
          cookie: "auth-token=invalid-token",
        },
      }
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid token" });
  });

  it("returns metadata successfully", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (getImageMetadata as jest.Mock).mockResolvedValueOnce([
      {
        id: "test-id",
        fileName: "test.jpg",
        url: "https://example.com/test.jpg",
        size: 1000,
        type: "image/jpeg",
        uploadedBy: "test@example.com",
      },
    ]);

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/metadata",
      {
        method: "GET",
        headers: {
          cookie: "auth-token=valid-token",
        },
      }
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      metadata: [
        {
          id: "test-id",
          fileName: "test.jpg",
          url: "https://example.com/test.jpg",
          size: 1000,
          type: "image/jpeg",
          uploadedBy: "test@example.com",
        },
      ],
    });

    expect(getImageMetadata).toHaveBeenCalled();
  });

  it("handles metadata fetch errors", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });
    (getImageMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("Fetch failed")
    );

    const request = new MockNextRequest(
      "http://localhost:3000/api/images/metadata",
      {
        method: "GET",
        headers: {
          cookie: "auth-token=valid-token",
        },
      }
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to fetch metadata" });
  });
});
