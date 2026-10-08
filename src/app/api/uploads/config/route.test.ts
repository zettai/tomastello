jest.mock("@/lib/auth", () => ({ verifyToken: jest.fn() }));

import type { NextRequest } from "next/server";
import { GET } from "./route";
import { verifyToken } from "@/lib/auth";

function req(token?: string): NextRequest {
  return {
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
  } as unknown as NextRequest;
}

describe("GET /api/uploads/config", () => {
  afterEach(() => {
    delete process.env.UPLOAD_MODE;
    delete process.env.UPLOAD_CHUNK_SIZE_MB;
  });

  it("should return 401 when logged out", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("should return the mode and chunk size from the environment", async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ id: "1", email: "a@b.com" });
    process.env.UPLOAD_MODE = "presigned";
    process.env.UPLOAD_CHUNK_SIZE_MB = "8";
    const res = await GET(req("tok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "presigned", chunkSizeMb: 8 });
  });

  it("should default to presigned and 5 MB", async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ id: "1", email: "a@b.com" });
    const res = await GET(req("tok"));
    expect(await res.json()).toEqual({ mode: "presigned", chunkSizeMb: 5 });
  });
});
