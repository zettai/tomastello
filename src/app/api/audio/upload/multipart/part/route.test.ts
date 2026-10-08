jest.mock("@/lib/api", () => ({
  scalewayClient: { send: jest.fn() },
  SCALEWAY_BUCKET: "test-bucket",
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));
jest.mock("@/lib/presign", () => ({
  presignUploadPart: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET, PUT } from "./route";
import { presignUploadPart } from "@/lib/presign";
import { verifyToken } from "@/lib/auth";
import { scalewayClient } from "@/lib/api";

function makeRequest(
  params: Record<string, string>,
  token?: string,
  body?: ArrayBuffer
): NextRequest {
  const url = new URL("http://localhost/api/audio/upload/multipart/part");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return {
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    nextUrl: url,
    arrayBuffer: () => Promise.resolve(body ?? new ArrayBuffer(8)),
  } as unknown as NextRequest;
}

describe("PUT /api/audio/upload/multipart/part", () => {
  afterEach(() => {
    delete process.env.UPLOAD_MODE;
  });

  beforeEach(() => {
    process.env.UPLOAD_MODE = "relay";
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "user@test.com" });
    (scalewayClient.send as jest.Mock).mockResolvedValue({ ETag: '"etag-1"' });
  });

  it("returns 401 if no token", async () => {
    const res = await PUT(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await PUT(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "1" }, "bad"));
    expect(res.status).toBe(401);
  });

  it("returns 400 if uploadId is missing", async () => {
    const res = await PUT(makeRequest({ key: "audio/1-k1.mp3", partNumber: "1" }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "uploadId, key, and partNumber are required" });
  });

  it("returns 400 if key is missing", async () => {
    const res = await PUT(makeRequest({ uploadId: "u1", partNumber: "1" }, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if partNumber is missing", async () => {
    const res = await PUT(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3" }, "tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if partNumber is not a number", async () => {
    const res = await PUT(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "abc" }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid partNumber" });
  });

  it("returns 400 if partNumber is 0", async () => {
    const res = await PUT(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "0" }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid partNumber" });
  });

  it("returns 400 if partNumber is negative", async () => {
    const res = await PUT(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "-1" }, "tok"));
    expect(res.status).toBe(400);
  });

  it("calls UploadPartCommand and returns etag + partNumber", async () => {
    const res = await PUT(makeRequest({ uploadId: "upload-123", key: "audio/1-test.mp3", partNumber: "2" }, "tok"));
    expect(res.status).toBe(200);
    const data = await res.json() as { etag: string; partNumber: number };
    expect(data.etag).toBe('"etag-1"');
    expect(data.partNumber).toBe(2);

    const [cmd] = (scalewayClient.send as jest.Mock).mock.calls[0] as [{ input: Record<string, unknown> }];
    expect(cmd.input.UploadId).toBe("upload-123");
    expect(cmd.input.PartNumber).toBe(2);
  });

  it("returns 500 on S3 error", async () => {
    (scalewayClient.send as jest.Mock).mockRejectedValueOnce(new Error("S3 down"));
    const res = await PUT(makeRequest({ uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "1" }, "tok"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to upload part" });
  });
});

describe("upload mode guards and key checks", () => {
  const PARAMS = { uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "1", size: "5242880" };

  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "user@test.com" });
    (scalewayClient.send as jest.Mock).mockResolvedValue({ ETag: '"etag-1"' });
    (presignUploadPart as jest.Mock).mockResolvedValue("https://bucket.example/signed");
  });

  afterEach(() => {
    delete process.env.UPLOAD_MODE;
  });

  it("should reject PUT with 409 when the mode is presigned", async () => {
    process.env.UPLOAD_MODE = "presigned";
    const res = await PUT(makeRequest(PARAMS, "tok"));
    expect(res.status).toBe(409);
    expect(scalewayClient.send).not.toHaveBeenCalled();
  });

  it("should reject GET with 409 when the mode is relay", async () => {
    process.env.UPLOAD_MODE = "relay";
    const res = await GET(makeRequest(PARAMS, "tok"));
    expect(res.status).toBe(409);
    expect(presignUploadPart).not.toHaveBeenCalled();
  });

  it.each([
    ["a key outside audio/", "images/1-x.jpg"],
    ["a path-like key", "audio/../auth/users.json"],
    ["the users file", "auth/users.json"],
  ])("should reject %s with 400", async (_label, key) => {
    process.env.UPLOAD_MODE = "relay";
    const res = await PUT(makeRequest({ ...PARAMS, key }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid key" });
  });

  it("should reject a part number above the S3 limit", async () => {
    process.env.UPLOAD_MODE = "relay";
    const res = await PUT(makeRequest({ ...PARAMS, partNumber: "10001" }, "tok"));
    expect(res.status).toBe(400);
  });

  it("should reject a relayed part over the size cap with 413", async () => {
    process.env.UPLOAD_MODE = "relay";
    const res = await PUT(makeRequest(PARAMS, "tok", new ArrayBuffer(128 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect(scalewayClient.send).not.toHaveBeenCalled();
  });

  it("should return 401 from GET without a token", async () => {
    process.env.UPLOAD_MODE = "presigned";
    const res = await GET(makeRequest(PARAMS));
    expect(res.status).toBe(401);
  });

  it("should sign the part with its size when the mode is presigned", async () => {
    process.env.UPLOAD_MODE = "presigned";
    const res = await GET(makeRequest(PARAMS, "tok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://bucket.example/signed", partNumber: 1, expiresIn: 300 });
    expect(presignUploadPart).toHaveBeenCalledWith("audio/1-k1.mp3", "u1", 1, 5242880);
  });

  it("should validate params before signing", async () => {
    process.env.UPLOAD_MODE = "presigned";
    const res = await GET(makeRequest({ ...PARAMS, partNumber: "0" }, "tok"));
    expect(res.status).toBe(400);
    expect(presignUploadPart).not.toHaveBeenCalled();
  });

  it.each([["missing", undefined], ["zero", "0"], ["too large", String(200 * 1024 * 1024)], ["fractional", "1.5"]])(
    "should reject a %s size with 400",
    async (_label, size) => {
      process.env.UPLOAD_MODE = "presigned";
      const params: Record<string, string> = { uploadId: "u1", key: "audio/1-k1.mp3", partNumber: "1" };
      if (size !== undefined) params.size = size;
      const res = await GET(makeRequest(params, "tok"));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid size" });
    }
  );

  it("should return 500 when signing fails", async () => {
    process.env.UPLOAD_MODE = "presigned";
    (presignUploadPart as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    const res = await GET(makeRequest(PARAMS, "tok"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to sign part" });
  });
});
