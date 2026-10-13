jest.mock("@/lib/api", () => ({
  scalewayClient: { send: jest.fn() },
  SCALEWAY_BUCKET: "test-bucket",
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));
jest.mock("@/lib/rateLimiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock("@/lib/securityEvents", () => ({
  addSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { verifyToken } from "@/lib/auth";
import { scalewayClient } from "@/lib/api";
import { checkRateLimit } from "@/lib/rateLimiter";
import { addSecurityEvent } from "@/lib/securityEvents";

function makeRequest(body: unknown, token?: string, ip?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    headers: {
      get: (name: string) =>
        name === "x-forwarded-for" ? (ip ?? null) : null,
    },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

describe("POST /api/audio/upload/multipart/init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "user@test.com" });
    (scalewayClient.send as jest.Mock).mockResolvedValue({ UploadId: "upload-abc" });
    (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: true });
  });

  it("returns 401 if no token", async () => {
    const res = await POST(makeRequest({ fileName: "a.mp3", mimeType: "audio/mpeg", size: 1024 }));
    expect(res.status).toBe(401);
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest({ fileName: "a.mp3", mimeType: "audio/mpeg", size: 1024 }, "bad"));
    expect(res.status).toBe(401);
  });

  it("returns 400 if fileName is missing", async () => {
    const res = await POST(makeRequest({ mimeType: "audio/mpeg", size: 1024 }, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if mimeType is missing", async () => {
    const res = await POST(makeRequest({ fileName: "a.mp3", size: 1024 }, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if size is missing", async () => {
    const res = await POST(makeRequest({ fileName: "a.mp3", mimeType: "audio/mpeg" }, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 and records event for disallowed MIME type", async () => {
    const res = await POST(makeRequest({ fileName: "a.txt", mimeType: "text/plain", size: 1024 }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Only audio files are allowed" });
    expect(addSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "upload_rejected_mime" })
    );
  });

  it("returns 400 and records event for extension/MIME mismatch", async () => {
    const res = await POST(makeRequest({ fileName: "a.mp3", mimeType: "audio/ogg", size: 1024 }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "File extension does not match MIME type" });
    expect(addSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "upload_rejected_mime" })
    );
  });

  it("returns 400 and records event when file exceeds 100 MB", async () => {
    const res = await POST(makeRequest(
      { fileName: "big.mp3", mimeType: "audio/mpeg", size: 101 * 1024 * 1024 }, "tok"
    ));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "File exceeds the 100 MB limit" });
    expect(addSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "upload_rejected_size" })
    );
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: false, reason: "IP upload rate limit exceeded" });
    const res = await POST(makeRequest({ fileName: "a.mp3", mimeType: "audio/mpeg", size: 1024 }, "tok"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "IP upload rate limit exceeded" });
  });

  it("returns uploadId and key on success", async () => {
    const res = await POST(makeRequest(
      { fileName: "song.mp3", mimeType: "audio/mpeg", size: 1024 }, "tok"
    ));
    expect(res.status).toBe(200);
    const data = await res.json() as { uploadId: string; key: string };
    expect(data.uploadId).toBe("upload-abc");
    expect(data.key).toMatch(/^audio\/\d+-song\.mp3$/);
  });

  it("accepts WAV, AAC, WebM MIME types", async () => {
    for (const [fileName, mimeType] of [
      ["a.wav", "audio/wav"],
      ["a.aac", "audio/aac"],
      ["a.webm", "audio/webm"],
    ]) {
      (scalewayClient.send as jest.Mock).mockResolvedValueOnce({ UploadId: "uid" });
      const res = await POST(makeRequest({ fileName, mimeType, size: 1024 }, "tok"));
      expect(res.status).toBe(200);
    }
  });

  it("returns 500 on S3 error", async () => {
    (scalewayClient.send as jest.Mock).mockRejectedValueOnce(new Error("S3 down"));
    const res = await POST(makeRequest({ fileName: "a.mp3", mimeType: "audio/mpeg", size: 1024 }, "tok"));
    expect(res.status).toBe(500);
  });

  it("sanitizes special characters in file name for S3 key", async () => {
    const res = await POST(makeRequest(
      { fileName: "my song (2024).mp3", mimeType: "audio/mpeg", size: 1024 }, "tok"
    ));
    const data = await res.json() as { key: string };
    expect(data.key).not.toContain(" ");
    expect(data.key).not.toContain("(");
  });
});
