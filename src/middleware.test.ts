/**
 * @jest-environment node
 */
jest.mock("next/server", () => jest.requireActual("next/server"));
jest.mock("./lib/edgeAuth", () => ({
  verifyTokenEdge: jest.fn(),
}));

import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { verifyTokenEdge } from "./lib/edgeAuth";

const verify = verifyTokenEdge as jest.Mock;

function request(path: string, token?: string) {
  const req = new NextRequest(`https://example.test${path}`);
  if (token) req.cookies.set("auth-token", token);
  return req;
}

describe("middleware", () => {
  beforeEach(() => {
    verify.mockReset();
  });

  it.each(["/admin", "/api/images/upload", "/api/audio/reorder"])(
    "redirects %s to login when there is no token",
    async (path) => {
      const res = await middleware(request(path));

      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("redirect")).toBe(path);
      expect(verify).not.toHaveBeenCalled();
    }
  );

  it("redirects and clears the cookie when the token is invalid", async () => {
    verify.mockResolvedValue(null);

    const res = await middleware(request("/admin", "bad"));

    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toMatch(/auth-token=;.*Max-Age=0/i);
  });

  it("lets a valid token through to admin", async () => {
    verify.mockResolvedValue({ id: "1", email: "admin@test.com" });

    const res = await middleware(request("/admin", "good"));

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends a logged-in user from login to admin", async () => {
    verify.mockResolvedValue({ id: "1", email: "admin@test.com" });

    const res = await middleware(request("/login", "good"));

    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin");
  });

  it("keeps the login page for an invalid token", async () => {
    verify.mockResolvedValue(null);

    const res = await middleware(request("/login", "bad"));

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves public pages alone", async () => {
    const res = await middleware(request("/"));

    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(verify).not.toHaveBeenCalled();
  });

  it("redirects /register to login", async () => {
    const res = await middleware(request("/register"));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});
