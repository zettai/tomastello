jest.mock("@/lib/api", () => ({
  scalewayClient: { send: jest.fn() },
  SCALEWAY_BUCKET: "test-bucket",
}));
jest.mock("@/lib/audioMetadata", () => ({
  addAudioMetadata: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));
jest.mock("@/lib/rateLimiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  recordUpload: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/securityEvents", () => ({
  addSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/notifier", () => ({
  notifyServerError: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { verifyToken } from "@/lib/auth";
import { scalewayClient } from "@/lib/api";
import { addAudioMetadata } from "@/lib/audioMetadata";
import { checkRateLimit } from "@/lib/rateLimiter";
import { ConflictError } from "@/lib/jsonStore";

const createRequest = (
  token: string | null,
  formDataOverride?: () => Promise<FormData>,
  ip?: string
) =>
  ({
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    headers: {
      get: (name: string) => (name === "x-forwarded-for" ? (ip ?? null) : null),
    },
    formData: formDataOverride ?? (() => Promise.resolve(new FormData())),
  } as unknown as NextRequest);

const makeFormData = (fields: Record<string, string | File>) => {
  const fd = {
    get: (key: string) => fields[key] ?? null,
  } as unknown as FormData;
  return () => Promise.resolve(fd);
};

describe("POST /api/audio/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCW_DEFAULT_REGION = "nl-ams";
    (verifyToken as jest.Mock).mockResolvedValue({ email: "user@test.com" });
    (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: true });
  });

  it("returns 401 if no token", async () => {
    const res = await POST(createRequest(null));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await POST(createRequest("bad-token"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if no file", async () => {
    const res = await POST(createRequest("tok", makeFormData({})));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "No file provided" });
  });

  it("returns 400 if title is missing", async () => {
    const file = new File(["data"], "s.mp3", { type: "audio/mpeg" });
    const res = await POST(createRequest("tok", makeFormData({ file })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Title is required" });
  });

  it("returns 400 if title is blank", async () => {
    const file = new File(["data"], "s.mp3", { type: "audio/mpeg" });
    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "   " }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Title is required" });
  });

  it("returns 400 if MIME type is not audio", async () => {
    const file = new File(["data"], "s.txt", { type: "text/plain" });
    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Song" }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Only audio files are allowed" });
  });

  it("returns 400 if file extension does not match MIME type", async () => {
    const file = new File(["data"], "s.mp3", { type: "audio/ogg" });
    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Song" }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "File extension does not match MIME type",
    });
  });

  it("returns 400 if file too large (101 MB)", async () => {
    const file = {
      name: "big.mp3",
      size: 101 * 1024 * 1024,
      type: "audio/mpeg",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1])),
    } as unknown as File;
    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Big" }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "File exceeds the 100 MB limit",
    });
  });

  it("returns 429 if rate-limited", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: false,
      reason: "IP upload rate limit exceeded",
    });
    const file = new File(["data"], "s.mp3", { type: "audio/mpeg" });
    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Song" }), "1.2.3.4")
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "IP upload rate limit exceeded",
    });
  });

  it("accepts WAV files", async () => {
    const file = {
      name: "clip.wav",
      size: 1024,
      type: "audio/wav",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    } as unknown as File;

    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (addAudioMetadata as jest.Mock).mockResolvedValueOnce({
      id: "2",
      title: "Clip",
    });

    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Clip" }))
    );
    expect(res.status).toBe(200);
    expect((await res.json()).mimeType).toBe("audio/wav");
  });

  it("returns 200 on successful upload", async () => {
    const file = {
      name: "song.mp3",
      size: 1024,
      type: "audio/mpeg",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    } as unknown as File;

    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (addAudioMetadata as jest.Mock).mockResolvedValueOnce({
      id: "1",
      title: "Song",
    });

    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Song" }))
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.fileName).toMatch(/^audio\/\d+-song\.mp3$/);
    expect(data.mimeType).toBe("audio/mpeg");
  });

  it("returns 500 on S3 error", async () => {
    const file = {
      name: "song.mp3",
      size: 1024,
      type: "audio/mpeg",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1])),
    } as unknown as File;

    (scalewayClient.send as jest.Mock).mockRejectedValueOnce(
      new Error("S3 failure")
    );

    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Song" }))
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to upload audio" });
  });

  it("should return 409 when another save collides", async () => {
    const file = {
      name: "song.mp3",
      size: 1024,
      type: "audio/mpeg",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1])),
    } as unknown as File;

    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (addAudioMetadata as jest.Mock).mockRejectedValueOnce(new ConflictError("metadata/test.json"));

    const res = await POST(
      createRequest("tok", makeFormData({ file, title: "Song" }))
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});
