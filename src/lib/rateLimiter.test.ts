/**
 * The limiter keeps its counters in the bucket (via jsonStore). These tests back jsonStore with
 * one in-memory map shared by every module instance, the way separate serverless instances
 * share the bucket.
 */
const store = new Map<string, unknown>();

jest.mock("./jsonStore", () => ({
  readJson: jest.fn(async (key: string, fallback: unknown) => ({ data: store.get(key) ?? fallback, etag: null })),
  updateJson: jest.fn(async (key: string, fallback: unknown, mutate: (v: unknown) => unknown) => {
    const next = mutate(store.get(key) ?? fallback);
    store.set(key, next);
    return next;
  }),
}));

type Limiter = typeof import("./rateLimiter");
type Events = { getSystemLock: jest.Mock; setSystemLock: jest.Mock; addSecurityEvent: jest.Mock };
type Notifier = { notifySystemLocked: jest.Mock; notifyRateLimitAbuse: jest.Mock };

/** A fresh module instance (its own per-instance state), with its own mocks. */
function instance(lock: { locked: boolean } = { locked: false }): { limiter: Limiter; events: Events; notifier: Notifier } {
  let result: { limiter: Limiter; events: Events; notifier: Notifier } | undefined;
  jest.isolateModules(() => {
    jest.doMock("./securityEvents", () => ({
      getSystemLock: jest.fn().mockResolvedValue(lock),
      setSystemLock: jest.fn().mockResolvedValue(undefined),
      addSecurityEvent: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock("./notifier", () => ({
      notifySystemLocked: jest.fn().mockResolvedValue(undefined),
      notifyRateLimitAbuse: jest.fn().mockResolvedValue(undefined),
    }));
    result = {
      limiter: jest.requireActual("./rateLimiter"),
      events: jest.requireMock("./securityEvents"),
      notifier: jest.requireMock("./notifier"),
    };
  });
  if (!result) throw new Error("module did not load");
  return result;
}

const HOUR = 60 * 60 * 1000;

describe("rateLimiter", () => {
  beforeEach(() => {
    store.clear();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.MAX_UPLOADS_PER_IP_HOUR;
    delete process.env.MAX_UPLOADS_PER_USER_HOUR;
    delete process.env.MAX_SYSTEM_BYTES_24H;
  });

  describe("checkRateLimit", () => {
    it("should allow an upload when nothing has been uploaded", async () => {
      const { limiter } = instance();
      await expect(limiter.checkRateLimit("1.2.3.4", "user@test.com")).resolves.toEqual({ allowed: true });
    });

    it("should block while the system lock is on", async () => {
      const { limiter } = instance({ locked: true });
      await expect(limiter.checkRateLimit("1.2.3.4", "user@test.com")).resolves.toEqual({
        allowed: false,
        reason: "System upload limit reached for today",
      });
    });

    it("should count uploads recorded by another instance", async () => {
      process.env.MAX_UPLOADS_PER_IP_HOUR = "3";
      const a = instance();
      const b = instance();
      for (let i = 0; i < 3; i++) await a.limiter.recordUpload("5.5.5.5", `u${i}@t.com`, 100);

      const result = await b.limiter.checkRateLimit("5.5.5.5", "other@t.com");

      expect(result).toEqual({ allowed: false, reason: "IP upload rate limit exceeded" });
      expect(b.events.addSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "rate_limit_ip" }));
    });

    it("should block a user over the hourly limit from any IP", async () => {
      process.env.MAX_UPLOADS_PER_USER_HOUR = "2";
      const { limiter, events } = instance();
      await limiter.recordUpload("1.1.1.1", "busy@t.com", 1);
      await limiter.recordUpload("2.2.2.2", "busy@t.com", 1);

      await expect(limiter.checkRateLimit("3.3.3.3", "busy@t.com")).resolves.toEqual({
        allowed: false,
        reason: "User upload rate limit exceeded",
      });
      expect(events.addSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "rate_limit_user" }));
    });

    it("should forget uploads older than an hour for the hourly limits", async () => {
      process.env.MAX_UPLOADS_PER_IP_HOUR = "1";
      const { limiter } = instance();
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now - 2 * HOUR);
      await limiter.recordUpload("1.1.1.1", "u@t.com", 1);
      jest.spyOn(Date, "now").mockReturnValue(now);

      await expect(limiter.checkRateLimit("1.1.1.1", "u@t.com")).resolves.toEqual({ allowed: true });
    });

    it("should lock the system when the last 24 hours already exceed the byte cap", async () => {
      process.env.MAX_SYSTEM_BYTES_24H = "1000";
      const { limiter, events } = instance();
      store.set("metadata/upload-usage.json", [{ ts: Date.now(), ip: "x", user: "y", bytes: 2000 }]);

      await expect(limiter.checkRateLimit("1.1.1.1", "u@t.com")).resolves.toEqual({
        allowed: false,
        reason: "System upload limit reached for today",
      });
      expect(events.setSystemLock).toHaveBeenCalledWith(expect.objectContaining({ locked: true, bytesIn24h: 2000 }));
    });

    it("should send an abuse alert after 3 blocked attempts", async () => {
      process.env.MAX_UPLOADS_PER_IP_HOUR = "0";
      const { limiter, notifier } = instance();
      for (let i = 0; i < 3; i++) await limiter.checkRateLimit("9.9.9.9", "bad@actor.com");
      await Promise.resolve();
      expect(notifier.notifyRateLimitAbuse).toHaveBeenCalledWith({ ip: "9.9.9.9", userEmail: "bad@actor.com", hitCount: 3 });
    });
  });

  describe("recordUpload", () => {
    it("should store the upload and drop records older than 24 hours", async () => {
      const { limiter } = instance();
      const old = { ts: Date.now() - 25 * HOUR, ip: "old", user: "old", bytes: 5 };
      store.set("metadata/upload-usage.json", [old]);

      await limiter.recordUpload("1.2.3.4", "user@test.com", 1024);

      expect(store.get("metadata/upload-usage.json")).toEqual([
        { ts: expect.any(Number), ip: "1.2.3.4", user: "user@test.com", bytes: 1024 },
      ]);
    });

    it("should lock the system and notify when an upload crosses the daily cap", async () => {
      process.env.MAX_SYSTEM_BYTES_24H = "1000";
      const { limiter, events, notifier } = instance();

      await limiter.recordUpload("1.2.3.4", "user@test.com", 1001);

      expect(events.setSystemLock).toHaveBeenCalledWith(expect.objectContaining({ locked: true }));
      expect(events.addSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "system_lock" }));
      expect(notifier.notifySystemLocked).toHaveBeenCalledWith({ bytesIn24h: 1001, lastUserEmail: "user@test.com" });
    });

    it("should not lock below the cap", async () => {
      process.env.MAX_SYSTEM_BYTES_24H = "1000";
      const { limiter, events } = instance();
      await limiter.recordUpload("1.2.3.4", "user@test.com", 999);
      expect(events.setSystemLock).not.toHaveBeenCalled();
    });
  });

  describe("unlockSystem", () => {
    it("should clear the lock and log a manual unlock", async () => {
      const { limiter, events } = instance({ locked: true });

      await limiter.unlockSystem();

      expect(events.setSystemLock).toHaveBeenCalledWith({ locked: false });
      expect(events.addSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "manual_unlock" }));
      await expect(limiter.checkRateLimit("1.2.3.4", "u@t.com")).resolves.toEqual({ allowed: true });
    });
  });
});
