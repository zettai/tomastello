import { DEFAULT_UPLOAD_CONFIG, fetchUploadConfig, putToSignedUrl } from "./uploadClient";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) };
}

describe("uploadClient", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("fetchUploadConfig", () => {
    it("should return the server's settings", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ mode: "presigned", chunkSizeMb: 8 }));
      await expect(fetchUploadConfig()).resolves.toEqual({ mode: "presigned", chunkSizeMb: 8 });
      expect(global.fetch).toHaveBeenCalledWith("/api/uploads/config");
    });

    it.each([
      ["an unknown mode", { mode: "other", chunkSizeMb: 8 }, { mode: "relay", chunkSizeMb: 8 }],
      ["a chunk size under 5", { mode: "presigned", chunkSizeMb: 1 }, { mode: "presigned", chunkSizeMb: 5 }],
      ["a missing chunk size", { mode: "presigned" }, { mode: "presigned", chunkSizeMb: 5 }],
    ])("should sanitise %s", async (_label, body, expected) => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(body));
      await expect(fetchUploadConfig()).resolves.toEqual(expected);
    });

    it("should fall back to defaults on an error status", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false));
      await expect(fetchUploadConfig()).resolves.toEqual(DEFAULT_UPLOAD_CONFIG);
    });

    it("should fall back to defaults when the request throws", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
      await expect(fetchUploadConfig()).resolves.toEqual(DEFAULT_UPLOAD_CONFIG);
    });
  });

  describe("putToSignedUrl", () => {
    const blob = new Blob(["abc"]);

    it("should PUT the body with the headers and return the ETag", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers({ ETag: '"e1"' }), text: () => Promise.resolve("") });
      await expect(putToSignedUrl("https://b/x", blob, { "Content-Type": "image/png" })).resolves.toBe('"e1"');
      expect(global.fetch).toHaveBeenCalledWith("https://b/x", {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/png" },
      });
    });

    it("should return an empty string when the ETag is not exposed", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers(), text: () => Promise.reject(new Error("aborted")) });
      await expect(putToSignedUrl("https://b/x", blob)).resolves.toBe("");
    });

    it("should return null when the bucket rejects the upload", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, headers: new Headers(), text: () => Promise.resolve("<Error/>") });
      await expect(putToSignedUrl("https://b/x", blob)).resolves.toBeNull();
    });
  });
});
