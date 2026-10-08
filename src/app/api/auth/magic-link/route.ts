import { NextResponse } from "next/server";
import { redeemLoginLink, requestLoginLink } from "@/lib/auth/magic-link";
import { seeOther } from "@/lib/auth/redirect";

function siteOrigin(request: Request): string {
  return (
    process.env.TOMASTELLO_SITE_URL?.trim() ||
    process.env.URL?.trim() ||
    new URL(request.url).origin
  );
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.USE_SECURE_COOKIES === "true",
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60,
  };
}

/** Redeem the token from the sign-in email and set the session cookie. */
export async function GET(request: Request) {
  const result = await redeemLoginLink(new URL(request.url).searchParams.get("token"));
  if (!result) return seeOther("/login?error=expired");
  const res = seeOther(result.next);
  res.cookies.set("auth-token", result.authToken, sessionCookieOptions());
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

/** Request a magic sign-in link (JSON body from the login page). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const origin = siteOrigin(request);
    const outcome = await requestLoginLink(
      { email: body.email, next: body.next ?? body.redirect },
      request.headers,
      origin,
    );
    if (!outcome.ok) {
      if (outcome.reason === "invalid") {
        return NextResponse.json({ success: false, error: "Enter a valid email address" }, { status: 400 });
      }
      return NextResponse.json(
        { success: false, error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }
    return NextResponse.json({
      success: true,
      message: "If this address can sign in, you will receive an email shortly.",
    });
  } catch (err) {
    console.error("Magic link request failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: "Could not send sign-in email. Try again later." },
      { status: 500 },
    );
  }
}
