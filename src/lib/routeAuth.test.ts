jest.mock("./auth", () => ({ verifyToken: jest.fn() }));

import type { NextRequest } from "next/server";
import { verifyToken } from "./auth";
import { clientIp, requireUser } from "./routeAuth";

function req(token?: string, forwarded?: string): NextRequest {
  return {
    cookies: { get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined) },
    headers: { get: (name: string) => (name === "x-forwarded-for" ? (forwarded ?? null) : null) },
  } as unknown as NextRequest;
}

describe("routeAuth", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return 401 when there is no cookie", async () => {
    const result = await requireUser(req());
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({ error: "Authentication required" });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("should return 401 when the token is invalid", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const result = await requireUser(req("bad"));
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({ error: "Invalid token" });
  });

  it("should return the user when the token is valid", async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ id: "1", email: "a@b.com" });
    await expect(requireUser(req("good"))).resolves.toEqual({ user: { id: "1", email: "a@b.com" } });
  });

  it.each([
    ["1.1.1.1, 2.2.2.2", "1.1.1.1"],
    [undefined, "unknown"],
    ["", "unknown"],
  ])("should read client ip from %p", (header, expected) => {
    expect(clientIp(req(undefined, header))).toBe(expected);
  });
});
