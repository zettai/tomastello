import { ConflictError } from "./jsonStore";
import { conflictResponse } from "./storeErrors";

jest.mock("./api", () => ({ SCALEWAY_BUCKET: "b", scalewayClient: { send: jest.fn() } }));

describe("conflictResponse", () => {
  it("should answer 409 for a ConflictError", async () => {
    const res = conflictResponse(new ConflictError("metadata/links.json"));
    expect(res?.status).toBe(409);
    expect(await res?.json()).toEqual({ error: "Someone else saved at the same moment. Reload and try again." });
  });

  it.each([new Error("boom"), "text", undefined])("should return null for %p", (error) => {
    expect(conflictResponse(error)).toBeNull();
  });
});
