import { GET } from "./route";
import { scalewayClient } from "@/lib/api";
import { verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";

// Mock dependencies
jest.mock("@/lib/api", () => ({
  scalewayClient: {
    send: jest.fn(),
  },
  SCALEWAY_BUCKET: "test-bucket",
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

function request(token?: string) {
  // jest.setup.ts mocks next/server, so build the request the way the route reads it
  return {
    url: "http://localhost/api/images/list",
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
  } as unknown as NextRequest;
}

describe("GET /api/images/list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCW_DEFAULT_REGION = "test-region";
    (verifyToken as jest.Mock).mockResolvedValue({ id: "1", email: "admin@test.com" });
  });

  it("rejects requests without a token and never lists the bucket", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(scalewayClient.send).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);

    const response = await GET(request("bad"));

    expect(response.status).toBe(401);
    expect(scalewayClient.send).not.toHaveBeenCalled();
  });

  it("returns list of images sorted by last modified", async () => {
    const mockImages = [
      {
        Key: "images/image1.jpg",
        Size: 1000,
        LastModified: new Date("2024-01-02"),
      },
      {
        Key: "images/image2.jpg",
        Size: 2000,
        LastModified: new Date("2024-01-01"),
      },
    ];

    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({
      Contents: mockImages,
    });

    const response = await GET(request("valid"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      images: [
        {
          key: "images/image1.jpg",
          url: "https://test-bucket.s3.test-region.scw.cloud/images/image1.jpg",
          size: 1000,
          lastModified: new Date("2024-01-02"),
        },
        {
          key: "images/image2.jpg",
          url: "https://test-bucket.s3.test-region.scw.cloud/images/image2.jpg",
          size: 2000,
          lastModified: new Date("2024-01-01"),
        },
      ],
    });

    expect(scalewayClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: "test-bucket",
          Prefix: "images/",
          MaxKeys: 100,
        },
      })
    );
  });

  it("returns empty array when no images found", async () => {
    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({
      Contents: [],
    });

    const response = await GET(request("valid"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      images: [],
    });
  });

  it("handles list errors", async () => {
    (scalewayClient.send as jest.Mock).mockRejectedValueOnce(
      new Error("List failed")
    );

    const response = await GET(request("valid"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to fetch images" });
  });
});
