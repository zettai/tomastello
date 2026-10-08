import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SignJWT, jwtVerify, errors } from "jose";
import { generateToken, resolveUserForMagicLink } from "@/lib/auth";
import { safeNext } from "@/lib/auth/safeNext";
import { isEmailLike } from "@/lib/text";
import { clientIp, createRateLimiter, type RateLimiter } from "@/lib/rate-limit";

/**
 * Email magic-link sign-in for allowlisted admins (`TOMASTELLO_ADMIN_EMAILS`).
 * Link JWTs are separate from session cookies (issuer/audience) but signed with `JWT_SECRET`.
 */

export const LINK_TTL_SECONDS = 15 * 60;
const ISSUER = "tomastello-admin";
const AUDIENCE = "tomastello-login-link";

type Env = Record<string, string | undefined>;

export const linkIpLimiter: RateLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
export const linkEmailLimiter: RateLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

function linkSecret(env: Env = process.env): Uint8Array {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be set");
  return new TextEncoder().encode(secret);
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !isEmailLike(email)) return null;
  return email;
}

export function allowedEmails(env: Env = process.env): Set<string> {
  return new Set(
    (env.TOMASTELLO_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => normalizeEmail(e))
      .filter((e): e is string => e !== null),
  );
}

export async function issueLoginLinkToken(
  email: string,
  next: string,
  secret: Uint8Array = linkSecret(),
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return new SignJWT({ next })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(email)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + LINK_TTL_SECONDS)
    .sign(secret);
}

export async function verifyLoginLinkToken(
  token: string | null | undefined,
  deps: { secret?: Uint8Array; env?: Env; nowSeconds?: number } = {},
): Promise<{ email: string; next: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, deps.secret ?? linkSecret(deps.env), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: deps.nowSeconds === undefined ? undefined : new Date(deps.nowSeconds * 1000),
    });
    const email = normalizeEmail(payload.sub);
    if (!email || !allowedEmails(deps.env).has(email)) return null;
    return { email, next: safeNext(payload.next) };
  } catch (err) {
    if (err instanceof errors.JOSEError || err instanceof TypeError) return null;
    throw err;
  }
}

export interface LinkMailer {
  sendLoginLink(to: string, url: string): Promise<void>;
}

export class ResendLinkMailer implements LinkMailer {
  constructor(
    private readonly config: { apiKey: string; from: string },
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async sendLoginLink(to: string, url: string): Promise<void> {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.config.from,
        to: [to],
        subject: "Your sign-in link for tomas-tello.stream",
        text:
          `Hello,\n\nSomeone asked to sign in to the Tomas Tello admin site with this email address. ` +
          `If that was you, open this link:\n\n${url}\n\n` +
          `The link works for 15 minutes. If you did not ask for it, you can ignore this email.\n\n` +
          `tomas-tello.stream`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend answered ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
  }
}

/** Resend expects a plain address or `Name <addr>`; trim env noise (e.g. trailing newlines from compose). */
export function magicLinkFromAddress(env: Env = process.env): string {
  const raw = env.TOMASTELLO_MAGIC_LINK_FROM?.trim() || env.NOTIFY_EMAIL_FROM?.trim() || "noreply@tomas-tello.stream";
  if (raw.includes("<")) return raw;
  return `Tomas Tello <${raw}>`;
}

export class ConsoleLinkMailer implements LinkMailer {
  constructor(private readonly dataDir: string) {}

  async sendLoginLink(to: string, url: string): Promise<void> {
    console.info(`[ConsoleLinkMailer] sign-in link for ${to}: ${url}`);
    const dir = path.join(this.dataDir, "outbox");
    await mkdir(dir, { recursive: true });
    await appendFile(
      path.join(dir, "login-links.jsonl"),
      JSON.stringify({ to, url, at: new Date().toISOString() }) + "\n",
    );
  }
}

export function getLinkMailer(env: Env = process.env): LinkMailer {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return new ConsoleLinkMailer(env.TOMASTELLO_DATA_DIR?.trim() || path.join(process.cwd(), ".data"));
  }
  return new ResendLinkMailer({ apiKey, from: magicLinkFromAddress(env) });
}

export type LinkRequestOutcome = { ok: true } | { ok: false; reason: "limited" | "invalid" };

export async function requestLoginLink(
  input: { email: unknown; next: unknown },
  headers: Headers,
  origin: string,
  deps: { mailer?: LinkMailer; env?: Env; ipLimiter?: RateLimiter; emailLimiter?: RateLimiter } = {},
): Promise<LinkRequestOutcome> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: "invalid" };
  if (!(deps.ipLimiter ?? linkIpLimiter).hit(clientIp(headers)).allowed) return { ok: false, reason: "limited" };
  if (!(deps.emailLimiter ?? linkEmailLimiter).hit(email).allowed) return { ok: true };
  if (!allowedEmails(deps.env).has(email)) return { ok: true };
  const token = await issueLoginLinkToken(email, safeNext(input.next), linkSecret(deps.env));
  const url = new URL("/api/auth/magic-link", origin);
  url.searchParams.set("token", token);
  await (deps.mailer ?? getLinkMailer(deps.env)).sendLoginLink(email, url.toString());
  return { ok: true };
}

export async function redeemLoginLink(
  token: string | null,
  deps: { env?: Env; nowSeconds?: number } = {},
): Promise<{ authToken: string; next: string } | null> {
  const link = await verifyLoginLinkToken(token, deps);
  if (!link) return null;
  const user = await resolveUserForMagicLink(link.email);
  const authToken = await generateToken(user);
  return { authToken, next: link.next };
}
