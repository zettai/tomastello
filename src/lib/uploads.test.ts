jest.mock("./api", () => ({ SCALEWAY_BUCKET: "test-bucket" }));

import {
  audioExtensionMatches,
  buildObjectKey,
  getChunkSizeMb,
  getExtension,
  getUploadMode,
  isUploadKey,
  publicObjectUrl,
} from "./uploads";

describe("uploads", () => {
  describe("getUploadMode", () => {
    it.each([
      [undefined, "presigned"],
      ["relay", "relay"],
      [" RELAY ", "relay"],
      ["presigned", "presigned"],
      ["direct", "presigned"],
    ])("should map UPLOAD_MODE=%p to %s", (value, expected) => {
      expect(getUploadMode({ UPLOAD_MODE: value })).toBe(expected);
    });
  });

  describe("getChunkSizeMb", () => {
    it.each([
      [undefined, 5],
      ["abc", 5],
      ["8", 8],
      ["1", 5],
      ["500", 64],
    ])("should map UPLOAD_CHUNK_SIZE_MB=%p to %d", (value, expected) => {
      expect(getChunkSizeMb({ UPLOAD_CHUNK_SIZE_MB: value })).toBe(expected);
    });
  });

  describe("getExtension", () => {
    it.each([
      ["song.MP3", ".mp3"],
      ["archive.tar.gz", ".gz"],
      ["noext", ""],
    ])("should return the extension of %s", (name, expected) => {
      expect(getExtension(name)).toBe(expected);
    });
  });

  describe("audioExtensionMatches", () => {
    it.each([
      ["song.mp3", "audio/mpeg", true],
      ["song.m4a", "audio/aac", true],
      ["song", "audio/mpeg", true],
      ["song.wav", "audio/mpeg", false],
      ["song.xyz", "audio/unknown", true],
    ])("should say %s with %s matches: %p", (name, mime, expected) => {
      expect(audioExtensionMatches(name, mime)).toBe(expected);
    });
  });

  describe("buildObjectKey", () => {
    it("should prefix, timestamp and sanitise the name", () => {
      expect(buildObjectKey("images", "my photo (1).jpg", 42)).toBe("images/42-my_photo__1_.jpg");
    });

    it("should keep only the last 200 characters of a long name", () => {
      const key = buildObjectKey("audio", `${"a".repeat(300)}.mp3`, 1);
      expect(key).toBe(`audio/1-${"a".repeat(196)}.mp3`);
    });

    it("should fall back to a placeholder for an empty name", () => {
      expect(buildObjectKey("audio", "", 1)).toBe("audio/1-file");
    });

    it("should produce keys that isUploadKey accepts", () => {
      expect(isUploadKey("audio", buildObjectKey("audio", "../../etc/passwd"))).toBe(true);
    });
  });

  describe("isUploadKey", () => {
    it.each([
      ["audio", "audio/123-song.mp3", true],
      ["images", "images/123-a_b.jpg", true],
      ["audio", "images/123-a.jpg", false],
      ["audio", "audio/song.mp3", false],
      ["audio", "audio/1-a/b.mp3", false],
      ["audio", "auth/users.json", false],
      ["audio", 42, false],
      ["audio", `audio/1-${"a".repeat(300)}`, false],
    ] as const)("should check %s key %p: %p", (prefix, key, expected) => {
      expect(isUploadKey(prefix, key)).toBe(expected);
    });
  });

  it("should build the public URL from the bucket and region", () => {
    expect(publicObjectUrl("images/1-a.jpg", { SCW_DEFAULT_REGION: "nl-ams" })).toBe(
      "https://test-bucket.s3.nl-ams.scw.cloud/images/1-a.jpg"
    );
  });
});
