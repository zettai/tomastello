const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  notifySystemLocked,
  notifyRateLimitAbuse,
  notifyServerError,
} from "./notifier";

describe("notifier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFY_EMAIL_TO;
    delete process.env.NOTIFY_EMAIL_FROM;
  });

  describe("when RESEND_API_KEY or NOTIFY_EMAIL_TO is unset", () => {
    it("notifySystemLocked does nothing", async () => {
      await notifySystemLocked({ bytesIn24h: 1000 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("notifyRateLimitAbuse does nothing", async () => {
      await notifyRateLimitAbuse({ ip: "1.2.3.4", userEmail: "u@t.com", hitCount: 5 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("notifyServerError does nothing", async () => {
      await notifyServerError({ error: "oops", context: "test" });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("when credentials are set", () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = "re_test_key";
      process.env.NOTIFY_EMAIL_TO = "admin@example.com";
      mockFetch.mockResolvedValue({ ok: true });
    });

    it("notifySystemLocked sends to Resend with MB amount and user email", async () => {
      await notifySystemLocked({ bytesIn24h: 512 * 1024 * 1024, lastUserEmail: "user@test.com" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.resend.com/emails");
      expect(opts.method).toBe("POST");

      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(body.to).toBe("admin@example.com");
      expect(body.from).toBe("noreply@tomas-tello.stream");
      expect((body.subject as string)).toContain("System upload lock");
      expect((body.html as string)).toContain("512.0 MB");
      expect((body.html as string)).toContain("user@test.com");
    });

    it("notifySystemLocked omits user line when no lastUserEmail", async () => {
      await notifySystemLocked({ bytesIn24h: 1024 * 1024 });

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect((body.html as string)).not.toContain("Last uploader");
    });

    it("notifyRateLimitAbuse sends IP, user, and hit count", async () => {
      await notifyRateLimitAbuse({ ip: "10.0.0.1", userEmail: "bad@actor.com", hitCount: 7 });

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.resend.com/emails");

      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect((body.subject as string)).toContain("Rate limit abuse");
      expect((body.html as string)).toContain("10.0.0.1");
      expect((body.html as string)).toContain("bad@actor.com");
      expect((body.html as string)).toContain("7");
    });

    it("notifyServerError sends error and context", async () => {
      await notifyServerError({ error: "TypeError: x is null", context: "audio/upload POST" });

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect((body.subject as string)).toContain("Server error");
      expect((body.html as string)).toContain("TypeError: x is null");
      expect((body.html as string)).toContain("audio/upload POST");
    });

    it("uses NOTIFY_EMAIL_FROM override", async () => {
      process.env.NOTIFY_EMAIL_FROM = "custom@sender.com";
      await notifyServerError({ error: "e", context: "c" });

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(body.from).toBe("custom@sender.com");
    });

    it("does not throw when fetch rejects", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      await expect(notifySystemLocked({ bytesIn24h: 100 })).resolves.toBeUndefined();
    });

    it("does not throw when fetch returns non-ok", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 422 });
      await expect(notifyServerError({ error: "e", context: "c" })).resolves.toBeUndefined();
    });
  });
});
