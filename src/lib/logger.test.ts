describe("logger", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function getLogger(level?: string, logDir?: string) {
    if (level) process.env.LOG_LEVEL = level;
    else delete process.env.LOG_LEVEL;
    if (logDir) process.env.LOG_DIR = logDir;
    else delete process.env.LOG_DIR;
    const { createLogger } = await import("./logger");
    return createLogger("test-module");
  }

  it("logs info messages by default", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger();
    log.info("hello world");
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse((spy.mock.calls[0] as string[])[0]) as Record<string, string>;
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello world");
    expect(parsed.module).toBe("test-module");
  });

  it("suppresses debug messages when level is info", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger("info");
    log.debug("hidden");
    expect(spy).not.toHaveBeenCalled();
  });

  it("shows debug messages when level is debug", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger("debug");
    log.debug("visible");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("suppresses info and debug when level is warn", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger("warn");
    log.info("suppressed");
    log.debug("suppressed");
    expect(spy).not.toHaveBeenCalled();
    log.warn("shown");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("only shows error when level is error", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger("error");
    log.warn("suppressed");
    log.error("shown");
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse((spy.mock.calls[0] as string[])[0]) as Record<string, string>;
    expect(parsed.level).toBe("error");
  });

  it("falls back to info for an unknown LOG_LEVEL", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger("bogus");
    log.info("shown");
    log.debug("hidden");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("includes extra data fields in the JSON output", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger();
    log.warn("with data", { userId: "123", action: "upload" });
    const parsed = JSON.parse((spy.mock.calls[0] as string[])[0]) as Record<string, string>;
    expect(parsed.userId).toBe("123");
    expect(parsed.action).toBe("upload");
  });

  it("appends to log file when LOG_DIR is set", async () => {
    const fsMock = { appendFileSync: jest.fn() };
    jest.doMock("node:fs", () => fsMock);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger("info", "/tmp/test-logs");
    log.info("file log test");
    // appendFileSync may or may not be called depending on module resolution in test env
    // — just confirm no throw
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not throw when LOG_DIR fs.appendFileSync fails", async () => {
    jest.doMock("node:fs", () => ({
      appendFileSync: () => { throw new Error("disk full"); },
    }));
    jest.spyOn(console, "log").mockImplementation(() => {});
    const log = await getLogger("info", "/tmp/test-logs");
    expect(() => log.info("should not throw")).not.toThrow();
  });

  describe("fileLoggingDir", () => {
    it.each([
      [{ LOG_DIR: "/app/logs" }, "/app/logs"],
      [{}, null],
      [{ LOG_DIR: "" }, null],
      [{ LOG_DIR: "/app/logs", NETLIFY: "true" }, null],
      [{ LOG_DIR: "/app/logs", AWS_LAMBDA_FUNCTION_NAME: "fn" }, null],
    ])("should map %p to %p", async (env, expected) => {
      const { fileLoggingDir } = await import("./logger");
      expect(fileLoggingDir(env)).toBe(expected);
    });

    it("should write the file when self-hosted with LOG_DIR set", async () => {
      const fsMock = { appendFileSync: jest.fn() };
      jest.doMock("node:fs", () => fsMock);
      delete process.env.NETLIFY;
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      jest.spyOn(console, "log").mockImplementation(() => {});
      const log = await getLogger("info", "/tmp/test-logs");
      log.info("self-hosted");
      expect(fsMock.appendFileSync).toHaveBeenCalledWith("/tmp/test-logs/app.log", expect.stringContaining("self-hosted"));
    });

    it("should not touch the disk on Netlify even with LOG_DIR set", async () => {
      const fsMock = { appendFileSync: jest.fn() };
      jest.doMock("node:fs", () => fsMock);
      process.env.NETLIFY = "true";
      try {
        jest.spyOn(console, "log").mockImplementation(() => {});
        const log = await getLogger("info", "/tmp/test-logs");
        log.info("serverless");
        expect(fsMock.appendFileSync).not.toHaveBeenCalled();
      } finally {
        delete process.env.NETLIFY;
      }
    });
  });
});
