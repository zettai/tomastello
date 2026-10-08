import type { UserPayload } from "./auth";
import { verifySessionToken } from "./sessionJwt";

/** Edge-safe session check for middleware (jose only; no Node crypto from jsonwebtoken). */
export async function verifyTokenEdge(token: string): Promise<UserPayload | null> {
  return verifySessionToken(token);
}
