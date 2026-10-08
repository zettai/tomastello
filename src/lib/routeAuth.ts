import { NextRequest, NextResponse } from "next/server";
import { verifyToken, type UserPayload } from "./auth";

export type AuthResult = { user: UserPayload; response?: undefined } | { user?: undefined; response: NextResponse };

/** Checks the auth-token cookie; on failure returns the 401 response to send. */
export async function requireUser(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  const user = await verifyToken(token);
  if (!user) {
    return { response: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }
  return { user };
}

/** First address in X-Forwarded-For, or "unknown". */
export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
