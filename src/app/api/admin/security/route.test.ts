jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));
jest.mock("@/lib/securityEvents", () => ({
  getSecurityEvents: jest.fn(),
  getSystemLock: jest.fn(),
  addSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/rateLimiter", () => ({
  unlockSystem: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { verifyToken } from "@/lib/auth";
import { getSecurityEvents, getSystemLock } from "@/lib/securityEvents";
import { unlockSystem } from "@/lib/rateLimiter";

function makeRequest(
  method: string,
  body?: unknown,
  token?: string
): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === "auth-token" && token ? { value: token } : undefined,
    },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

describe("GET /api/admin/security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "admin@test.com" });
    (getSystemLock as jest.Mock).mockResolvedValue({ locked: false });
    (getSecurityEvents as jest.Mock).mockResolvedValue([]);
  });

  it("returns 401 if no token", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeRequest("GET", undefined, "bad"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns lock and empty events", async () => {
    const res = await GET(makeRequest("GET", undefined, "tok"));
    expect(res.status).toBe(200);
    const data = await res.json() as { lock: unknown; events: unknown[] };
    expect(data.lock).toEqual({ locked: false });
    expect(data.events).toEqual([]);
  });

  it("returns up to 10 most recent events", async () => {
    const events = Array.from({ length: 15 }, (_, i) => ({
      type: "rate_limit_ip",
      ts: new Date(1000 + i).toISOString(),
      ip: "1.2.3.4",
    }));
    (getSecurityEvents as jest.Mock).mockResolvedValue(events);

    const res = await GET(makeRequest("GET", undefined, "tok"));
    const data = await res.json() as { events: unknown[] };
    expect(data.events).toHaveLength(10);
    expect(data.events[0]).toEqual(events[0]);
  });

  it("returns locked system state", async () => {
    (getSystemLock as jest.Mock).mockResolvedValue({
      locked: true,
      lockedAt: "2026-06-06T00:00:00.000Z",
      reason: "Daily upload byte limit exceeded",
      bytesIn24h: 1073741824,
    });

    const res = await GET(makeRequest("GET", undefined, "tok"));
    const data = await res.json() as { lock: { locked: boolean } };
    expect(data.lock.locked).toBe(true);
  });
});

describe("POST /api/admin/security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ email: "admin@test.com" });
  });

  it("returns 401 if no token", async () => {
    const res = await POST(makeRequest("POST", { action: "unlock" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 if invalid token", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest("POST", { action: "unlock" }, "bad"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for unknown action", async () => {
    const res = await POST(makeRequest("POST", { action: "nuke" }, "tok"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown action" });
  });

  it("calls unlockSystem and returns success for action:unlock", async () => {
    const res = await POST(makeRequest("POST", { action: "unlock" }, "tok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(unlockSystem).toHaveBeenCalledTimes(1);
  });
});
