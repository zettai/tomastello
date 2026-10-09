import { readApiError } from "./readApiError";

describe("readApiError", () => {
  it("should return JSON error when present", async () => {
    const res = {
      json: async () => ({ error: "Conflict detail" }),
    } as Response;
    await expect(readApiError(res, "fallback")).resolves.toBe("Conflict detail");
  });

  it("should return fallback when body has no error", async () => {
    const res = {
      json: async () => ({ success: false }),
    } as Response;
    await expect(readApiError(res, "fallback")).resolves.toBe("fallback");
  });

  it("should return fallback when JSON parse fails", async () => {
    const res = {
      json: async () => {
        throw new Error("bad");
      },
    } as unknown as Response;
    await expect(readApiError(res, "fallback")).resolves.toBe("fallback");
  });
});
