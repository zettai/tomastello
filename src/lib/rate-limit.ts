/**
 * Best-effort in-memory fixed-window rate limiter (per serverless instance on Netlify).
 */
export type RateLimiter = {
  hit(key: string): { allowed: boolean; retryAfterSeconds: number };
  reset(key: string): void;
};

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, { count: number; start: number }>();

  return {
    hit(key) {
      const t = now();
      let b = buckets.get(key);
      if (!b || t - b.start >= windowMs) {
        if (buckets.size >= maxKeys) {
          for (const [k, v] of Array.from(buckets.entries())) if (t - v.start >= windowMs) buckets.delete(k);
          if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
        }
        b = { count: 0, start: t };
        buckets.set(key, b);
      }
      b.count += 1;
      const allowed = b.count <= limit;
      return { allowed, retryAfterSeconds: allowed ? 0 : Math.ceil((b.start + windowMs - t) / 1000) };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
