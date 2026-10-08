import {
  getSecurityEvents,
  addSecurityEvent,
  getSystemLock,
  setSystemLock,
} from "./securityEvents";
import { readStoredJson, seedJson } from "@/test/storeHelpers";

const EVENTS_KEY = "metadata/security-events.json";
const LOCK_KEY = "metadata/system-lock.json";

describe("securityEvents", () => {
  describe("getSecurityEvents", () => {
    it("returns empty array when key does not exist", async () => {
      const result = await getSecurityEvents();
      expect(result).toEqual([]);
    });

    it("returns parsed events from store", async () => {
      const events = [
        { type: "rate_limit_ip", ts: "2026-06-06T00:00:00.000Z", ip: "1.2.3.4" },
      ];
      await seedJson(EVENTS_KEY, events);
      const result = await getSecurityEvents();
      expect(result).toEqual(events);
    });
  });

  describe("addSecurityEvent", () => {
    it("prepends new event and persists", async () => {
      const existing = [
        { type: "system_lock" as const, ts: "2026-01-01T00:00:00.000Z" },
      ];
      await seedJson(EVENTS_KEY, existing);

      await addSecurityEvent({ type: "manual_unlock", userEmail: "admin@test.com" });

      const saved = await readStoredJson<Array<{ type: string }>>(EVENTS_KEY);
      expect(saved[0].type).toBe("manual_unlock");
      expect(saved[1].type).toBe("system_lock");
    });

    it("caps events at 100", async () => {
      const existing = Array.from({ length: 100 }, (_, i) => ({
        type: "rate_limit_ip" as const,
        ts: new Date(i).toISOString(),
        ip: "1.2.3.4",
      }));
      await seedJson(EVENTS_KEY, existing);

      await addSecurityEvent({ type: "upload_rejected_mime" });

      const saved = await readStoredJson<unknown[]>(EVENTS_KEY);
      expect(saved).toHaveLength(100);
    });

    it("adds ts timestamp to new event", async () => {
      await addSecurityEvent({ type: "rate_limit_user", ip: "10.0.0.1" });

      const saved = await readStoredJson<Array<{ ts: string }>>(EVENTS_KEY);
      expect(saved[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("getSystemLock", () => {
    it("returns { locked: false } when key does not exist", async () => {
      const result = await getSystemLock();
      expect(result).toEqual({ locked: false });
    });

    it("returns parsed lock state from store", async () => {
      const lock = {
        locked: true,
        lockedAt: "2026-06-06T00:00:00.000Z",
        reason: "test",
      };
      await seedJson(LOCK_KEY, lock);
      const result = await getSystemLock();
      expect(result).toEqual(lock);
    });
  });

  describe("setSystemLock", () => {
    it("writes lock JSON to store", async () => {
      await seedJson(LOCK_KEY, { locked: false });
      const lock = { locked: true, lockedAt: "2026-06-06T00:00:00.000Z" };
      await setSystemLock(lock);

      expect(await readStoredJson(LOCK_KEY)).toEqual(lock);
    });
  });
});
