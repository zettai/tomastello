jest.mock("@/lib/api", () => ({
  scalewayClient: { send: jest.fn() },
  SCALEWAY_BUCKET: "test-bucket",
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));
jest.mock("@/lib/audioMetadata", () => ({
  addAudioMetadata: jest.fn(),
}));
jest.mock("@/lib/rateLimiter", () => ({
  recordUpload: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/notifier", () => ({
  notifyServerError: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/objects", () => ({
  headObject: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  ensureObjectPublic: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { verifyToken } from "@/lib/auth";
import { scalewayClient } from "@/lib/api";
import { addAudioMetadata } from "@/lib/audioMetadata";
import { recordUpload } from "@/lib/rateLimiter";
import { notifyServerError } from "@/lib/notifier";
import { deleteObject, headObject } from "@/lib/objects";
import { ConflictError } from "@/lib/jsonStore";

const VALID_BODY = {
  uploadId: "upload-123",
  key: "audio/123-song.mp3",
  parts: [
    { partNumber: 1, etag: '"etag-1"' },
    { partNumber: 2, etag: '"etag-2"' },
  ],
  title: "My Song",
  mimeType: "audio/mpeg",
  size: 12 * 1024 * 1024,
};

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

describe("POST /api/audio/upload/multipart/complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCW_DEFAULT_REGION = "nl-ams";
    (verifyToken as jest.Mock).mockResolvedValue({ email: "user@test.com" });
    (scalewayClient.send as jest.Mock).mockResolvedValue({});
    (addAudioMetadata as jest.Mock).mockResolvedValue({ id: "m1", title: "My Song" });
    (headObject as jest.Mock).mockResolvedValue({ size: VALID_BODY.size, contentType: "audio/mpeg" });
  });

  it("returns 401 if no token", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY, "bad-token"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if uploadId is missing", async () => {
    const body = { ...VALID_BODY, uploadId: undefined };
    const res = await POST(makeRequest(body, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if key is missing", async () => {
    const body = { ...VALID_BODY, key: undefined };
    const res = await POST(makeRequest(body, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if parts is missing", async () => {
    const body = { ...VALID_BODY, parts: undefined };
    const res = await POST(makeRequest(body, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if title is missing", async () => {
    const body = { ...VALID_BODY, title: undefined };
    const res = await POST(makeRequest(body, "tok"));
    expect(res.status).toBe(400);
  });

  it("calls CompleteMultipartUploadCommand with correct parts", async () => {
    const res = await POST(makeRequest(VALID_BODY, "tok"));
    expect(res.status).toBe(200);

    const [command] = (scalewayClient.send as jest.Mock).mock.calls[0] as [{ input: Record<string, unknown> }];
    expect(command.input.UploadId).toBe("upload-123");
    expect(command.input.Key).toBe("audio/123-song.mp3");
    expect((command.input.MultipartUpload as { Parts: unknown[] }).Parts).toHaveLength(2);
  });

  it("returns success with public URL and metadata", async () => {
    const res = await POST(makeRequest(VALID_BODY, "tok"));
    expect(res.status).toBe(200);

    const data = await res.json() as { success: boolean; url: string; metadata: unknown };
    expect(data.success).toBe(true);
    expect(data.url).toBe(
      "https://test-bucket.s3.nl-ams.scw.cloud/audio/123-song.mp3"
    );
    expect(data.metadata).toEqual({ id: "m1", title: "My Song" });
  });

  it("calls recordUpload with ip, email, and size", async () => {
    await POST(makeRequest(VALID_BODY, "tok", "10.0.0.1"));
    expect(recordUpload).toHaveBeenCalledWith("10.0.0.1", "user@test.com", VALID_BODY.size);
  });

  it("calls addAudioMetadata with correct fields", async () => {
    await POST(makeRequest(VALID_BODY, "tok"));
    expect(addAudioMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Song",
        mimeType: "audio/mpeg",
        size: VALID_BODY.size,
        uploadedBy: "user@test.com",
      })
    );
  });

  it("returns 500 and notifies on S3 error", async () => {
    (scalewayClient.send as jest.Mock).mockRejectedValue(new Error("S3 failure"));
    const res = await POST(makeRequest(VALID_BODY, "tok"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to complete upload" });
    expect(notifyServerError).toHaveBeenCalled();
  });

  it("should return 409 when another save collides", async () => {
    (addAudioMetadata as jest.Mock).mockRejectedValueOnce(new ConflictError("metadata/test.json"));
    const res = await POST(makeRequest(VALID_BODY, "tok"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });

  it("uses 'unknown' ip when x-forwarded-for header is absent", async () => {
    await POST(makeRequest(VALID_BODY, "tok"));
    expect(recordUpload).toHaveBeenCalledWith("unknown", "user@test.com", VALID_BODY.size);
  });

  it("should record the size the bucket reports, not the size the client sent", async () => {
    (headObject as jest.Mock).mockResolvedValue({ size: 7, contentType: "audio/mpeg" });
    await POST(makeRequest({ ...VALID_BODY, size: 1 }, "tok", "10.0.0.1"));
    expect(recordUpload).toHaveBeenCalledWith("10.0.0.1", "user@test.com", 7);
    expect(addAudioMetadata).toHaveBeenCalledWith(expect.objectContaining({ size: 7 }));
  });

  it("should delete the object and return 400 when it is over 100 MB", async () => {
    (headObject as jest.Mock).mockResolvedValue({ size: 100 * 1024 * 1024 + 1, contentType: "audio/mpeg" });
    const res = await POST(makeRequest(VALID_BODY, "tok"));
    expect(res.status).toBe(400);
    expect(deleteObject).toHaveBeenCalledWith("audio/123-song.mp3");
    expect(addAudioMetadata).not.toHaveBeenCalled();
  });

  it("should return 400 without deleting when the object is missing", async () => {
    (headObject as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY, "tok"));
    expect(res.status).toBe(400);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it.each([
    ["a key outside audio/", { key: "metadata/site.json" }],
    ["empty parts", { parts: [] }],
  ])("should reject %s with 400", async (_label, override) => {
    const res = await POST(makeRequest({ ...VALID_BODY, ...override }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid key or parts" });
    expect(scalewayClient.send).not.toHaveBeenCalled();
  });
});
