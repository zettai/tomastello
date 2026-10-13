jest.mock("@/lib/auth/magic-link", () => ({
  redeemLoginLink: jest.fn(),
  requestLoginLink: jest.fn(),
}));

jest.mock("@/lib/auth/redirect", () => ({
  seeOther: jest.fn((path: string) => ({
    status: 303,
    headers: { get: (name: string) => (name === "Location" ? path : null), set: jest.fn() },
    cookies: { set: jest.fn() },
  })),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { redeemLoginLink, requestLoginLink } from "@/lib/auth/magic-link";

function postRequest(body: unknown, jsonThrows = false) {
  return {
    url: "http://localhost/api/auth/magic-link",
    headers: new Headers(),
    json: jsonThrows
      ? jest.fn().mockRejectedValue(new SyntaxError("bad json"))
      : jest.fn().mockResolvedValue(body),
  } as unknown as Request;
}

describe("GET /api/auth/magic-link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should redirect when token redeems successfully", async () => {
    (redeemLoginLink as jest.Mock).mockResolvedValueOnce({
      authToken: "session",
      next: "/admin",
    });
    const request = new NextRequest("http://localhost/api/auth/magic-link?token=abc");
    const res = await GET(request);
    expect(res.status).toBe(303);
    expect(redeemLoginLink).toHaveBeenCalledWith("abc");
  });
});

describe("POST /api/auth/magic-link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 Invalid request when JSON is malformed", async () => {
    const res = await POST(postRequest({}, true));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
    expect(requestLoginLink).not.toHaveBeenCalled();
  });

  it("should return 400 Invalid request when email is not a string", async () => {
    const res = await POST(postRequest({ email: 1 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });

  it("should return the same success message for unknown allowlisted-shaped email", async () => {
    (requestLoginLink as jest.Mock).mockResolvedValueOnce({ ok: true });
    const res = await POST(postRequest({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: "If this address can sign in, you will receive an email shortly.",
    });
  });

  it("should keep invalid email format message for well-shaped body", async () => {
    (requestLoginLink as jest.Mock).mockResolvedValueOnce({ ok: false, reason: "invalid" });
    const res = await POST(postRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      success: false,
      error: "Enter a valid email address",
    });
  });
});
