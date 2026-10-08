import { SignJWT, jwtVerify } from "jose";

export interface SessionClaims {
  id: string;
  email: string;
}

function secretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be set");
  return new TextEncoder().encode(secret);
}

/** HS256 session cookie JWT (7d). Same format middleware verifies via `verifySessionToken`. */
export async function signSessionToken(user: SessionClaims): Promise<string> {
  return new SignJWT({ id: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secretBytes());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.id !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}
