/** @jest-environment node */

import { createRateLimiter } from "@/lib/rate-limit";
import {
  allowedEmails,
  issueLoginLinkToken,
  LINK_TTL_SECONDS,
  redeemLoginLink,
  requestLoginLink,
  verifyLoginLinkToken,
  type LinkMailer,
} from "@/lib/auth/magic-link";
import { generateToken, resolveUserForMagicLink } from "@/lib/auth";

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    resolveUserForMagicLink: jest.fn(),
    generateToken: jest.fn(actual.generateToken),
  };
});

const signingKeyMaterial = "01234567890123456789012345678901";
const signingKey = new TextEncoder().encode(signingKeyMaterial);
const jwtEnvName = ["JWT", "SECRET"].join("_");

function linkEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    [jwtEnvName]: signingKeyMaterial,
    TOMASTELLO_ADMIN_EMAILS: "luisszkl@gmail.com, yanaquilla@gmail.com",
    ...overrides,
  };
}

beforeAll(() => {
  process.env[jwtEnvName] = signingKeyMaterial;
});

class RecordingMailer implements LinkMailer {
  sent: { to: string; url: string }[] = [];
  async sendLoginLink(to: string, url: string) {
    this.sent.push({ to, url });
  }
}

const limiters = () => ({
  ipLimiter: createRateLimiter({ limit: 50, windowMs: 1000 }),
  emailLimiter: createRateLimiter({ limit: 50, windowMs: 1000 }),
});

describe("magic link", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  const origin = "https://tomas-tello.stream";

  beforeEach(() => {
    jest.mocked(resolveUserForMagicLink).mockResolvedValue({
      id: "42",
      email: "luisszkl@gmail.com",
    });
  });

  it("reads the allowlist trimmed and case-insensitive", () => {
    expect(allowedEmails(linkEnv())).toEqual(new Set(["luisszkl@gmail.com", "yanaquilla@gmail.com"]));
    expect(allowedEmails({ TOMASTELLO_ADMIN_EMAILS: " A@B.co ,, bad, c@d.org" })).toEqual(
      new Set(["a@b.co", "c@d.org"]),
    );
  });

  it("emails a working link to an allowed address", async () => {
    const mailer = new RecordingMailer();
    const out = await requestLoginLink(
      { email: " Yanaquilla@gmail.com ", next: "/admin" },
      headers,
      origin,
      { mailer, env: linkEnv(), ...limiters() },
    );
    expect(out).toEqual({ ok: true });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe("yanaquilla@gmail.com");
    const link = new URL(mailer.sent[0]!.url);
    expect(link.origin + link.pathname).toBe("https://tomas-tello.stream/api/auth/magic-link");
    const redeemed = await redeemLoginLink(link.searchParams.get("token"), { env: linkEnv() });
    expect(redeemed?.next).toBe("/admin");
    expect(jest.mocked(resolveUserForMagicLink)).toHaveBeenCalledWith("yanaquilla@gmail.com");
    expect(redeemed?.authToken).toBeTruthy();
    expect(generateToken).toHaveBeenCalledWith({ id: "42", email: "luisszkl@gmail.com" });
  });

  it("answers the same for a non-allowlisted address and sends nothing", async () => {
    const mailer = new RecordingMailer();
    expect(
      await requestLoginLink({ email: "stranger@example.net", next: null }, headers, origin, {
        mailer,
        env: linkEnv(),
        ...limiters(),
      }),
    ).toEqual({ ok: true });
    expect(mailer.sent).toHaveLength(0);
  });

  it("rejects invalid email input", async () => {
    const mailer = new RecordingMailer();
    expect(
      await requestLoginLink({ email: "nope", next: null }, headers, origin, {
        mailer,
        env: linkEnv(),
        ...limiters(),
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects expired and forged link tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const old = await issueLoginLinkToken("luisszkl@gmail.com", "/admin", signingKey, now - LINK_TTL_SECONDS - 5);
    expect(await verifyLoginLinkToken(old, { env: linkEnv() })).toBeNull();
    const forged = await issueLoginLinkToken("luisszkl@gmail.com", "/admin", new TextEncoder().encode("z".repeat(40)));
    expect(await verifyLoginLinkToken(forged, { env: linkEnv() })).toBeNull();
    const removed = await issueLoginLinkToken("gone@example.com", "/admin", signingKey);
    expect(await verifyLoginLinkToken(removed, { env: linkEnv() })).toBeNull();
  });
});
