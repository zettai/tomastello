jest.mock("@/lib/api", () => ({
  scalewayClient: { send: jest.fn() },
  SCALEWAY_BUCKET: "test-bucket",
}));
jest.mock("@/lib/audioMetadata", () => ({
  updateAudioMetadata: jest.fn(),
  deleteAudioMetadata: jest.fn(),
  getAudioMetadata: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));
jest.mock("@/lib/cdn", () => ({
  purgePublicPages: jest.fn(),
}));

import { NextRequest } from "next/server";
import { PUT, DELETE } from "./route";
import { verifyToken } from "@/lib/auth";
import { updateAudioMetadata, deleteAudioMetadata, getAudioMetadata } from "@/lib/audioMetadata";
import { purgePublicPages } from "@/lib/cdn";
import { scalewayClient } from "@/lib/api";
import type { AudioMetadata } from "@/types/audio";
import { ConflictError } from "@/lib/jsonStore";

const mockAudio: AudioMetadata = {
  id: "1",
  title: "Song",
  fileName: "audio/song.mp3",
  url: "https://x/audio/song.mp3",
  size: 1000,
  mimeType: "audio/mpeg",
  order: 1,
  uploadedAt: "",
  uploadedBy: "",
};

const makeCtx = (id: string) => ({
  params: Promise.resolve({ id }),
});

const makeReq = (token: string | null, body?: object) =>
  ({
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    json: () => Promise.resolve(body ?? {}),
  } as unknown as NextRequest);

describe("PUT /api/audio/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "u@test.com" });
  });

  it("returns 401 if no token", async () => {
    const res = await PUT(makeReq(null), makeCtx("1"));
    expect(res.status).toBe(401);
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await PUT(makeReq("bad"), makeCtx("1"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if title is blank", async () => {
    const res = await PUT(makeReq("tok", { title: "   " }), makeCtx("1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Title cannot be blank" });
  });

  it("returns 404 if audio not found", async () => {
    (updateAudioMetadata as jest.Mock).mockResolvedValueOnce(null);
    const res = await PUT(makeReq("tok", { title: "New" }), makeCtx("999"));
    expect(res.status).toBe(404);
  });

  it("returns 200 on successful rename", async () => {
    (updateAudioMetadata as jest.Mock).mockResolvedValueOnce({
      ...mockAudio,
      title: "New",
    });
    const res = await PUT(makeReq("tok", { title: "New" }), makeCtx("1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.audio.title).toBe("New");
  });

  it("returns 500 on storage error", async () => {
    (updateAudioMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("S3 fail")
    );
    const res = await PUT(makeReq("tok", { title: "New" }), makeCtx("1"));
    expect(res.status).toBe(500);
  });

  it("should return 409 when another save collides on rename", async () => {
    (updateAudioMetadata as jest.Mock).mockRejectedValueOnce(
      new ConflictError("metadata/test.json")
    );
    const res = await PUT(makeReq("tok", { title: "New" }), makeCtx("1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});

describe("DELETE /api/audio/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "u@test.com" });
  });

  it("returns 401 if no token", async () => {
    const res = await DELETE(makeReq(null), makeCtx("1"));
    expect(res.status).toBe(401);
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await DELETE(makeReq("bad"), makeCtx("1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 if audio not found", async () => {
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([]);
    const res = await DELETE(makeReq("tok"), makeCtx("999"));
    expect(res.status).toBe(404);
  });

  it("returns 200 on successful delete", async () => {
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([mockAudio]);
    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (deleteAudioMetadata as jest.Mock).mockResolvedValueOnce(true);
    (purgePublicPages as jest.Mock).mockResolvedValueOnce(undefined);

    const res = await DELETE(makeReq("tok"), makeCtx("1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(purgePublicPages).toHaveBeenCalled();
  });

  it("returns 500 on S3 error", async () => {
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([mockAudio]);
    (scalewayClient.send as jest.Mock).mockRejectedValueOnce(
      new Error("S3 fail")
    );

    const res = await DELETE(makeReq("tok"), makeCtx("1"));
    expect(res.status).toBe(500);
  });

  it("should return 409 when another save collides on delete", async () => {
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([mockAudio]);
    (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});
    (deleteAudioMetadata as jest.Mock).mockRejectedValueOnce(new ConflictError("metadata/test.json"));

    const res = await DELETE(makeReq("tok"), makeCtx("1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});
