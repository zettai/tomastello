import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getSecurityEvents, getSystemLock, addSecurityEvent } from "@/lib/securityEvents";
import { unlockSystem } from "@/lib/rateLimiter";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userPayload = await verifyToken(token);
  if (!userPayload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const [lock, events] = await Promise.all([
    getSystemLock(),
    getSecurityEvents(),
  ]);

  return NextResponse.json({ lock, events: events.slice(0, 10) });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userPayload = await verifyToken(token);
  if (!userPayload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await request.json() as { action?: string };
  if (body.action !== "unlock") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await unlockSystem();
  await addSecurityEvent({
    type: "manual_unlock",
    userEmail: userPayload.email,
  });

  return NextResponse.json({ success: true });
}
