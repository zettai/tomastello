import { addSecurityEvent, getSystemLock, setSystemLock } from "./securityEvents";
import { notifyRateLimitAbuse, notifySystemLocked } from "./notifier";
import { readJson, updateJson } from "./jsonStore";

const MAX_UPLOADS_PER_IP_HOUR = Number.parseInt(
  process.env.MAX_UPLOADS_PER_IP_HOUR ?? "10",
  10
);
const MAX_UPLOADS_PER_USER_HOUR = Number.parseInt(
  process.env.MAX_UPLOADS_PER_USER_HOUR ?? "20",
  10
);
const MAX_SYSTEM_BYTES_24H = Number.parseInt(
  process.env.MAX_SYSTEM_BYTES_24H ?? String(1024 * 1024 * 1024),
  10
);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LOCK_CACHE_TTL_MS = 60 * 1000;
const ABUSE_WINDOW_MS = 10 * 60 * 1000;
const ABUSE_THRESHOLD = 3;

/**
 * Recent uploads (last 24 h) live in the bucket, not in memory, so every server instance
 * (serverless functions run many) counts the same uploads. Written with optimistic
 * concurrency, so two uploads finishing at once are both counted.
 */
const USAGE_KEY = "metadata/upload-usage.json";

interface UploadRecord {
  ts: number;
  ip: string;
  user: string;
  bytes: number;
}

async function recentUploads(now: number): Promise<UploadRecord[]> {
  const { data } = await readJson<UploadRecord[]>(USAGE_KEY, []);
  return data.filter((r) => r.ts > now - DAY_MS);
}

const sumBytes = (records: UploadRecord[]) => records.reduce((sum, r) => sum + r.bytes, 0);

// Per-instance on purpose: only decides when to send an abuse email (at worst a few more or
// fewer emails per instance), and the lock below is re-read from the bucket every minute.
const abuseHits = new Map<string, number[]>();

let lockCache: { locked: boolean; fetchedAt: number } | null = null;

function pruneWindow(arr: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return arr.filter((t) => t > cutoff);
}

async function isSystemLocked(): Promise<boolean> {
  if (lockCache && Date.now() - lockCache.fetchedAt < LOCK_CACHE_TTL_MS) {
    return lockCache.locked;
  }
  const lock = await getSystemLock();
  lockCache = { locked: lock.locked, fetchedAt: Date.now() };
  return lock.locked;
}

export async function checkRateLimit(
  ip: string,
  email: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (await isSystemLocked()) {
    return { allowed: false, reason: "System upload limit reached for today" };
  }

  const now = Date.now();
  const records = await recentUploads(now);
  const lastHour = records.filter((r) => r.ts > now - HOUR_MS);

  if (lastHour.filter((r) => r.ip === ip).length >= MAX_UPLOADS_PER_IP_HOUR) {
    void trackAbuse(ip, email);
    await addSecurityEvent({ type: "rate_limit_ip", ip, userEmail: email });
    return { allowed: false, reason: "IP upload rate limit exceeded" };
  }

  if (lastHour.filter((r) => r.user === email).length >= MAX_UPLOADS_PER_USER_HOUR) {
    void trackAbuse(ip, email);
    await addSecurityEvent({ type: "rate_limit_user", ip, userEmail: email });
    return { allowed: false, reason: "User upload rate limit exceeded" };
  }

  const activeBytes = sumBytes(records);
  if (activeBytes >= MAX_SYSTEM_BYTES_24H) {
    await lockSystem(activeBytes, email);
    return { allowed: false, reason: "System upload limit reached for today" };
  }

  return { allowed: true };
}

export async function recordUpload(
  ip: string,
  email: string,
  bytes: number
): Promise<void> {
  const now = Date.now();
  const saved = await updateJson<UploadRecord[]>(USAGE_KEY, [], (records) => [
    ...records.filter((r) => r.ts > now - DAY_MS),
    { ts: now, ip, user: email, bytes },
  ]);

  // Re-check if we just crossed the system limit
  const totalBytes = sumBytes(saved);
  if (totalBytes >= MAX_SYSTEM_BYTES_24H) {
    await lockSystem(totalBytes, email);
  }
}

async function lockSystem(bytesIn24h: number, lastUserEmail: string): Promise<void> {
  await setSystemLock({
    locked: true,
    lockedAt: new Date().toISOString(),
    reason: "Daily upload byte limit exceeded",
    bytesIn24h,
  });
  lockCache = { locked: true, fetchedAt: Date.now() };
  await addSecurityEvent({
    type: "system_lock",
    userEmail: lastUserEmail,
    detail: `${bytesIn24h} bytes in 24h`,
  });
  void notifySystemLocked({ bytesIn24h, lastUserEmail });
}

async function trackAbuse(ip: string, email: string): Promise<void> {
  const key = `${ip}:${email}`;
  const hits = pruneWindow(abuseHits.get(key) ?? [], ABUSE_WINDOW_MS);
  hits.push(Date.now());
  abuseHits.set(key, hits);

  if (hits.length >= ABUSE_THRESHOLD) {
    void notifyRateLimitAbuse({ ip, userEmail: email, hitCount: hits.length });
  }
}

export async function unlockSystem(): Promise<void> {
  await setSystemLock({ locked: false });
  lockCache = { locked: false, fetchedAt: Date.now() };
  await addSecurityEvent({ type: "manual_unlock" });
}
