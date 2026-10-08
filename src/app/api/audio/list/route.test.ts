jest.mock("@/lib/audioMetadata", () => ({
  getAudioMetadata: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

import { GET } from "./route";
import { getAudioMetadata } from "@/lib/audioMetadata";
import { verifyToken } from "@/lib/auth";
import type { AudioMetadata } from "@/types/audio";
import { NextRequest } from "next/server";

function request(token?: string) {
  // jest.setup.ts mocks next/server, so build the request the way the route reads it
  return {
    url: "http://localhost/api/audio/list",
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
  } as unknown as NextRequest;
}

const track: AudioMetadata = {
  id: "1",
  title: "A",
  fileName: "a.mp3",
  url: "https://x/a.mp3",
  size: 100,
  mimeType: "audio/mpeg",
  order: 1,
  uploadedAt: "2026-01-01T00:00:00.000Z",
  uploadedBy: "admin@test.com",
};

describe("GET /api/audio/list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue(null);
  });

  it("hides the uploader email from the public", async () => {
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([track]);

    const data = await (await GET(request())).json();

    expect(data.audio[0]).not.toHaveProperty("uploadedBy");
    expect(data.audio[0]).toEqual({
      id: "1",
      title: "A",
      fileName: "a.mp3",
      url: "https://x/a.mp3",
      size: 100,
      mimeType: "audio/mpeg",
      order: 1,
      uploadedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("hides the uploader email when the token is invalid", async () => {
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([track]);

    const data = await (await GET(request("bad"))).json();

    expect(verifyToken).toHaveBeenCalledWith("bad");
    expect(data.audio[0]).not.toHaveProperty("uploadedBy");
  });

  it("shows the uploader email to admins", async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ id: "1", email: "admin@test.com" });
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([track]);

    const data = await (await GET(request("valid"))).json();

    expect(data.audio[0].uploadedBy).toBe("admin@test.com");
  });

  it("returns sorted audio list ascending by order", async () => {
    const audio: AudioMetadata[] = [
      {
        id: "2",
        title: "B",
        fileName: "b.mp3",
        url: "https://x/b.mp3",
        size: 500,
        mimeType: "audio/mpeg",
        order: 2,
        uploadedAt: "",
        uploadedBy: "",
      },
      {
        id: "1",
        title: "A",
        fileName: "a.mp3",
        url: "https://x/a.mp3",
        size: 100,
        mimeType: "audio/mpeg",
        order: 1,
        uploadedAt: "",
        uploadedBy: "",
      },
    ];
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce(audio);

    const res = await GET(request());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.audio[0].id).toBe("1");
    expect(data.audio[1].id).toBe("2");
  });

  it("returns empty list when no audio exists", async () => {
    (getAudioMetadata as jest.Mock).mockResolvedValueOnce([]);

    const res = await GET(request());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.audio).toEqual([]);
  });

  it("returns 500 on storage error", async () => {
    (getAudioMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("S3 error")
    );

    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch audio" });
  });
});
