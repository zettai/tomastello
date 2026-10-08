/** Same-site post-login paths only (no open redirects). */
export function safeNext(next: unknown, fallback = "/admin"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.startsWith("/login") || next.startsWith("/register")) return fallback;
  if (!/^\/[A-Za-z0-9/_-]*(\?[A-Za-z0-9=&_-]*)?$/.test(next)) return fallback;
  return next;
}
