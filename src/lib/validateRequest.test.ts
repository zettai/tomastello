import { z } from "zod";
import {
  INVALID_REQUEST,
  invalidRequestResponse,
  parseJsonBody,
  parseQuery,
  parseWithSchema,
  searchParamsRecord,
} from "./validateRequest";

describe("parseWithSchema", () => {
  it("should return data when input matches schema", () => {
    const schema = z.object({ id: z.string() });
    const result = parseWithSchema(schema, { id: "1" });
    expect(result).toEqual({ ok: true, data: { id: "1" } });
  });

  it("should return 400 Invalid request when validation fails", () => {
    const schema = z.object({ id: z.string().min(1) });
    const result = parseWithSchema(schema, { id: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(result.response.json()).resolves.toEqual(INVALID_REQUEST);
    }
  });
});

describe("parseJsonBody", () => {
  it("should return 400 when JSON is invalid", async () => {
    const request = {
      json: () => Promise.reject(new SyntaxError("bad json")),
    } as unknown as Request;
    const result = await parseJsonBody(request, z.object({ a: z.number() }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(await result.response.json()).toEqual(INVALID_REQUEST);
    }
  });
});

describe("parseQuery", () => {
  it("should map search params into an object for validation", () => {
    const params = new URLSearchParams("id=abc&missing=");
    expect(searchParamsRecord(params, ["id", "other"])).toEqual({
      id: "abc",
      other: null,
    });
  });

  it("should return 400 when query fails schema", () => {
    const params = new URLSearchParams("");
    const result = parseQuery(params, z.object({ id: z.string().min(1) }), ["id"]);
    expect(result.ok).toBe(false);
  });
});

describe("invalidRequestResponse", () => {
  it("should use the fixed error message", async () => {
    const res = invalidRequestResponse();
    expect(await res.json()).toEqual(INVALID_REQUEST);
    expect(res.status).toBe(400);
  });
});
