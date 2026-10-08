jest.mock("@/lib/auth", () => ({ verifyToken: jest.fn() }));
jest.mock("@/lib/api", () => ({ SCALEWAY_BUCKET: "test-bucket", scalewayClient: { send: jest.fn() } }));
jest.mock("@/lib/presign", () => ({ presignObjectPut: jest.fn() }));

import type { NextRequest } from "next/server";
import { POST } from "./route";
import { verifyToken } from "@/lib/auth";
import { presignObjectPut } from "@/lib/presign";

const VALID = { fileName: "My Photo.jpg", contentType: "image/jpeg", size: 2048 };

function req(body: unknown, token: string | null = "tok"): NextRequest {
  return {
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
    headers: { get: () => null },
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  } as unknown as NextRequest;
}

describe("POST /api/images/upload/presign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPLOAD_MODE = "presigned";
    (verifyToken as jest.Mock).mockResolvedValue({ id: "1", email: "a@b.com" });
    (presignObjectPut as jest.Mock).mockResolvedValue("https://bucket.example/signed");
  });

  afterEach(() => {
    delete process.env.UPLOAD_MODE;
  });

  it("should return 401 when logged out", async () => {
    const res = await POST(req(VALID, null));
    expect(res.status).toBe(401);
    expect(presignObjectPut).not.toHaveBeenCalled();
  });

  it("should return 409 in relay mode", async () => {
    process.env.UPLOAD_MODE = "relay";
    const res = await POST(req(VALID));
    expect(res.status).toBe(409);
  });

  it("should sign a server-chosen key and return the headers to send", async () => {
    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { url: string; key: string; headers: Record<string, string>; expiresIn: number };
    expect(data.url).toBe("https://bucket.example/signed");
    expect(data.key).toMatch(/^images\/\d+-My_Photo\.jpg$/);
    expect(data.headers).toEqual({ "Content-Type": "image/jpeg" });
    expect(data.expiresIn).toBe(300);
    expect(presignObjectPut).toHaveBeenCalledWith(data.key, "image/jpeg", 2048);
  });

  it("should not let the client pick the folder", async () => {
    const res = await POST(req({ ...VALID, fileName: "../auth/users.json" }));
    const data = (await res.json()) as { key: string };
    expect(data.key).toMatch(/^images\/\d+-\.\._auth_users\.json$/);
  });

  it.each([
    ["invalid JSON", new Error("bad json"), "Invalid JSON"],
    ["a missing name", { ...VALID, fileName: "" }, "fileName, contentType and size are required"],
    ["a non-number size", { ...VALID, size: "2048" }, "fileName, contentType and size are required"],
    ["an SVG", { ...VALID, contentType: "image/svg+xml" }, "Only JPEG, PNG, WebP, GIF and AVIF images are allowed"],
    ["a non-image", { ...VALID, contentType: "text/html" }, "Only JPEG, PNG, WebP, GIF and AVIF images are allowed"],
    ["an empty file", { ...VALID, size: 0 }, "File size must be a positive whole number"],
    ["a negative size", { ...VALID, size: -1 }, "File size must be a positive whole number"],
    ["a file over 30 MB", { ...VALID, size: 30 * 1024 * 1024 + 1 }, "File size must be less than 30MB"],
  ])("should reject %s with 400", async (_label, body, error) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(presignObjectPut).not.toHaveBeenCalled();
  });

  it("should return 500 when signing fails", async () => {
    (presignObjectPut as jest.Mock).mockRejectedValue(new Error("boom"));
    const res = await POST(req(VALID));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to sign upload" });
  });
});
