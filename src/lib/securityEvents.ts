import { readJson, updateJson } from "./jsonStore";

export type SecurityEventType =
  | "rate_limit_ip"
  | "rate_limit_user"
  | "system_lock"
  | "manual_unlock"
  | "upload_rejected_size"
  | "upload_rejected_mime";

export interface SecurityEvent {
  type: SecurityEventType;
  ts: string;
  ip?: string;
  userEmail?: string;
  detail?: string;
}

export interface SystemLock {
  locked: boolean;
  lockedAt?: string;
  reason?: string;
  bytesIn24h?: number;
}

const EVENTS_KEY = "metadata/security-events.json";
const LOCK_KEY = "metadata/system-lock.json";
const MAX_EVENTS = 100;

export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  return (await readJson<SecurityEvent[]>(EVENTS_KEY, [])).data;
}

export async function addSecurityEvent(event: Omit<SecurityEvent, "ts">): Promise<void> {
  const newEvent: SecurityEvent = { ...event, ts: new Date().toISOString() };
  await updateJson<SecurityEvent[]>(EVENTS_KEY, [], (events) => [newEvent, ...events].slice(0, MAX_EVENTS));
}

export async function getSystemLock(): Promise<SystemLock> {
  return (await readJson<SystemLock>(LOCK_KEY, { locked: false })).data;
}

/** Sets the lock. The new value doesn't depend on the old one, but the write still retries on conflict. */
export async function setSystemLock(lock: SystemLock): Promise<void> {
  await updateJson<SystemLock>(LOCK_KEY, { locked: false }, () => ({ ...lock }));
}
