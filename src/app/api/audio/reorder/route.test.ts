jest.mock("@/lib/audioMetadata", () => ({
  reorderAudioMetadata: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

import { NextRequest } from "next/server";
import { PUT } from "./route";
import { verifyToken } from "@/lib/auth";
import { reorderAudioMetadata } from "@/lib/audioMetadata";
import type { AudioMetadata } from "@/types/audio";
import { ConflictError } from "@/lib/jsonStore";

const makeReq = (token: string | null, body?: object) =>
  ({
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    json: () => Promise.resolve(body ?? {}),
  } as unknown as NextRequest);

const mockReordered: AudioMetadata[] = [
  {
    id: "2",
    title: "B",
    fileName: "b.mp3",
    url: "",
    size: 1,
    mimeType: "audio/mpeg",
    order: 1,
    uploadedAt: "",
    uploadedBy: "",
  },
  {
    id: "1",
    title: "A",
    fileName: "a.mp3",
    url: "",
    size: 1,
    mimeType: "audio/mpeg",
    order: 2,
    uploadedAt: "",
    uploadedBy: "",
  },
];

describe("PUT /api/audio/reorder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "u@test.com" });
  });

  it("returns 401 if no token", async () => {
    const res = await PUT(makeReq(null));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await PUT(makeReq("bad", { ids: ["1"] }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 400 if ids is missing", async () => {
    const res = await PUT(makeReq("tok", {}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "ids must be a non-empty array" });
  });

  it("returns 400 if ids is empty array", async () => {
    const res = await PUT(makeReq("tok", { ids: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "ids must be a non-empty array" });
  });

  it("returns 200 with reordered audio", async () => {
    (reorderAudioMetadata as jest.Mock).mockResolvedValueOnce(mockReordered);

    const res = await PUT(makeReq("tok", { ids: ["2", "1"] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.audio[0].id).toBe("2");
    expect(data.audio[1].id).toBe("1");
  });

  it("returns 500 on storage error", async () => {
    (reorderAudioMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("S3 fail")
    );

    const res = await PUT(makeReq("tok", { ids: ["1", "2"] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to reorder audio" });
  });

  it("should return 409 when another save collides", async () => {
    (reorderAudioMetadata as jest.Mock).mockRejectedValueOnce(
      new ConflictError("metadata/test.json")
    );

    const res = await PUT(makeReq("tok", { ids: ["1", "2"] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });
});
