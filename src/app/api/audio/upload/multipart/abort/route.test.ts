jest.mock("@/lib/api", () => ({
  scalewayClient: { send: jest.fn() },
  SCALEWAY_BUCKET: "test-bucket",
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

import { NextRequest } from "next/server";
import { DELETE } from "./route";
import { verifyToken } from "@/lib/auth";
import { scalewayClient } from "@/lib/api";

function makeRequest(params: Record<string, string>, token?: string): NextRequest {
  const url = new URL("http://localhost/api/audio/upload/multipart/abort");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return {
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    nextUrl: url,
  } as unknown as NextRequest;
}

describe("DELETE /api/audio/upload/multipart/abort", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "user@test.com" });
    (scalewayClient.send as jest.Mock).mockResolvedValue({});
  });

  it("returns 401 if no token", async () => {
    const res = await DELETE(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await DELETE(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3" }, "bad"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if uploadId is missing", async () => {
    const res = await DELETE(makeRequest({ key: "audio/1-k1.mp3" }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "uploadId and key are required" });
  });

  it("returns 400 if key is missing", async () => {
    const res = await DELETE(makeRequest({ uploadId: "u1" }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "uploadId and key are required" });
  });

  it("calls AbortMultipartUploadCommand and returns success", async () => {
    const res = await DELETE(makeRequest({ uploadId: "upload-123", key: "audio/1-test.mp3" }, "tok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const [cmd] = (scalewayClient.send as jest.Mock).mock.calls[0] as [{ input: Record<string, unknown> }];
    expect(cmd.input.UploadId).toBe("upload-123");
    expect(cmd.input.Key).toBe("audio/1-test.mp3");
  });

  it("returns 500 on S3 error", async () => {
    (scalewayClient.send as jest.Mock).mockRejectedValueOnce(new Error("S3 down"));
    const res = await DELETE(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3" }, "tok"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to abort upload" });
  });

  it("should reject a key outside audio/ with 400", async () => {
    const res = await DELETE(makeRequest({ uploadId: "u1", key: "auth/users.json" }, "tok"));
    expect(res.status).toBe(400);
    expect(scalewayClient.send).not.toHaveBeenCalled();
  });
});
