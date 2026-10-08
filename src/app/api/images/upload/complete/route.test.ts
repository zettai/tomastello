jest.mock("@/lib/auth", () => ({ verifyToken: jest.fn() }));
jest.mock("@/lib/api", () => ({ SCALEWAY_BUCKET: "test-bucket", scalewayClient: { send: jest.fn() } }));
jest.mock("@/lib/objects", () => ({
  headObject: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  ensureObjectPublic: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/metadata", () => ({ addImageMetadata: jest.fn(), getMetadataByFileName: jest.fn() }));

import type { NextRequest } from "next/server";
import { POST } from "./route";
import { verifyToken } from "@/lib/auth";
import { deleteObject, headObject } from "@/lib/objects";
import { addImageMetadata, getMetadataByFileName } from "@/lib/metadata";
import { ConflictError } from "@/lib/jsonStore";

const KEY = "images/1700000000000-photo.jpg";

function req(body: unknown, token: string | null = "tok"): NextRequest {
  return {
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  } as unknown as NextRequest;
}

describe("POST /api/images/upload/complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPLOAD_MODE = "presigned";
    process.env.SCW_DEFAULT_REGION = "nl-ams";
    (verifyToken as jest.Mock).mockResolvedValue({ id: "1", email: "a@b.com" });
    (getMetadataByFileName as jest.Mock).mockResolvedValue(null);
    (headObject as jest.Mock).mockResolvedValue({ size: 4096, contentType: "image/jpeg" });
    (addImageMetadata as jest.Mock).mockImplementation((m: object) => Promise.resolve({ id: "img-1", ...m }));
  });

  afterEach(() => {
    delete process.env.UPLOAD_MODE;
  });

  it("should return 401 when logged out", async () => {
    const res = await POST(req({ key: KEY }, null));
    expect(res.status).toBe(401);
  });

  it("should return 409 in relay mode", async () => {
    process.env.UPLOAD_MODE = "relay";
    const res = await POST(req({ key: KEY }));
    expect(res.status).toBe(409);
    expect(headObject).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", new Error("bad"), "Invalid JSON"],
    ["a key outside images/", { key: "audio/1-a.mp3" }, "Invalid key"],
    ["the users file", { key: "auth/users.json" }, "Invalid key"],
    ["a missing key", {}, "Invalid key"],
  ])("should reject %s with 400", async (_label, body, error) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it("should save metadata with the size and type the bucket reports", async () => {
    const res = await POST(req({ key: KEY, originalName: " Photo.jpg " }));
    expect(res.status).toBe(200);
    expect(addImageMetadata).toHaveBeenCalledWith({
      fileName: KEY,
      originalName: "Photo.jpg",
      url: `https://test-bucket.s3.nl-ams.scw.cloud/${KEY}`,
      size: 4096,
      type: "image/jpeg",
      uploadedBy: "a@b.com",
    });
    const data = (await res.json()) as { success: boolean; fileName: string; size: number };
    expect(data).toEqual(expect.objectContaining({ success: true, fileName: KEY, size: 4096 }));
  });

  it("should fall back to the key's file name when no original name is sent", async () => {
    await POST(req({ key: KEY }));
    expect(addImageMetadata).toHaveBeenCalledWith(expect.objectContaining({ originalName: "1700000000000-photo.jpg" }));
  });

  it("should return 409 when the image is already registered", async () => {
    (getMetadataByFileName as jest.Mock).mockResolvedValue({ id: "old" });
    const res = await POST(req({ key: KEY }));
    expect(res.status).toBe(409);
    expect(addImageMetadata).not.toHaveBeenCalled();
  });

  it("should return 404 when nothing was uploaded", async () => {
    (headObject as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ key: KEY }));
    expect(res.status).toBe(404);
  });

  it.each([
    ["a non-image type", { size: 10, contentType: "text/html" }],
    ["an oversized object", { size: 30 * 1024 * 1024 + 1, contentType: "image/png" }],
    ["an empty object", { size: 0, contentType: "image/png" }],
  ])("should delete %s and return 400", async (_label, stored) => {
    (headObject as jest.Mock).mockResolvedValue(stored);
    const res = await POST(req({ key: KEY }));
    expect(res.status).toBe(400);
    expect(deleteObject).toHaveBeenCalledWith(KEY);
    expect(addImageMetadata).not.toHaveBeenCalled();
  });

  it("should return 500 when the bucket fails", async () => {
    (headObject as jest.Mock).mockRejectedValue(new Error("down"));
    const res = await POST(req({ key: KEY }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to register image" });
  });

  it("should return 409 when another save collides", async () => {
    (addImageMetadata as jest.Mock).mockRejectedValueOnce(new ConflictError("metadata/test.json"));
    const res = await POST(req({ key: KEY }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});
