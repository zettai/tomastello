jest.mock("@/lib/api", () => ({
  scalewayClient: {
    send: jest.fn(),
  },
  SCALEWAY_BUCKET: "test-bucket",
}));
jest.mock("@/lib/metadata", () => ({
  addImageMetadata: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));
import { verifyToken } from "@/lib/auth";
import { scalewayClient } from "@/lib/api";
import { addImageMetadata } from "@/lib/metadata";

import { NextRequest } from "next/server";
import { POST } from "./route";
import { ConflictError } from "@/lib/jsonStore";

// Mock dependencies
jest.mock("@/lib/api", () => ({
  scalewayClient: {
    send: jest.fn(),
  },
  SCALEWAY_BUCKET: "test-bucket",
}));

jest.mock("@/lib/metadata", () => ({
  addImageMetadata: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

// Mock FormData
class MockFormData {
  private data = new Map<string, File>();

  append(name: string, value: File) {
    this.data.set(name, value);
  }

  get(name: string) {
    return this.data.get(name);
  }
}

// Replace the MockNextRequest class with a plain object
const createMockRequest = (token: string | null) =>
  ({
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    formData: () => Promise.resolve(new MockFormData() as unknown as FormData),
    json: () => Promise.resolve({}),
  } as unknown as NextRequest);

describe("POST /api/images/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCW_DEFAULT_REGION = "test-region";
    (verifyToken as jest.Mock).mockResolvedValue({ id: "test-user" });
  });

  it("returns 401 if no auth token", async () => {
    const request = createMockRequest(null);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const request = createMockRequest("invalid-token");
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if no file provided", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const request = createMockRequest("valid-token");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "No file provided" });
  });

  it("returns 400 if file is not an image", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const formData = new MockFormData();
    formData.append(
      "file",
      new File(["test"], "test.txt", { type: "text/plain" })
    );

    const request = createMockRequest("valid-token");

    // Before calling POST, mock formData on the request
    const requestFormData = jest.fn().mockResolvedValue(formData);
    request.formData = requestFormData;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Only image files are allowed" });
  });

  it("returns 400 if file is too large", async () => {
    (verifyToken as jest.Mock).mockResolvedValueOnce({
      email: "test@example.com",
    });

    const formData = new MockFormData();
    const largeFile = new File(["x".repeat(31 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", largeFile);

    const request = createMockRequest("valid-token");

    // Before calling POST, mock formData on the request
    const requestFormData = jest.fn().mockResolvedValue(formData);
    request.formData = requestFormData;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "File size must be less than 30MB" });
  });

  it("successfully uploads an image", async () => {
    const file = {
      name: "test.jpg",
      size: 1024,
      type: "image/jpeg",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    };
    (verifyToken as jest.Mock).mockResolvedValue({ id: "test-user" });
    (scalewayClient.send as jest.Mock).mockResolvedValue({});
    (addImageMetadata as jest.Mock).mockResolvedValue(undefined);
    const request = createMockRequest("valid-token");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (request as any).formData = jest
      .fn()
      .mockResolvedValue({ get: () => file });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual(
      expect.objectContaining({
        success: true,
        fileName: expect.stringMatching(/^images\/\d+-test\.jpg$/),
        url: expect.stringMatching(
          /^https:\/\/test-bucket\.s3\.test-region\.scw\.cloud\/images\/\d+-test\.jpg$/
        ),
        size: 1024,
        type: "image/jpeg",
        metadata: undefined,
      })
    );
  });

  it("handles upload errors", async () => {
    const file = {
      name: "test.jpg",
      size: 1024,
      type: "image/jpeg",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    };
    (verifyToken as jest.Mock).mockResolvedValue({ id: "test-user" });
    (scalewayClient.send as jest.Mock).mockRejectedValue(
      new Error("Upload failed")
    );
    const request = createMockRequest("valid-token");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (request as any).formData = jest
      .fn()
      .mockResolvedValue({ get: () => file });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to upload image" });
  });

  it("should return 409 when another save collides", async () => {
    const file = {
      name: "test.jpg",
      size: 1024,
      type: "image/jpeg",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    };
    (verifyToken as jest.Mock).mockResolvedValue({ id: "test-user" });
    (scalewayClient.send as jest.Mock).mockResolvedValue({});
    (addImageMetadata as jest.Mock).mockRejectedValueOnce(new ConflictError("metadata/test.json"));
    const request = createMockRequest("valid-token");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (request as any).formData = jest
      .fn()
      .mockResolvedValue({ get: () => file });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});
