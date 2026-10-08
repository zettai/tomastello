type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): LogLevel {
  const val = process.env.LOG_LEVEL ?? "info";
  return (val as LogLevel) in LEVELS ? (val as LogLevel) : "info";
}

/**
 * File logging is for the self-hosted container (LOG_DIR on a volume). Serverless hosts
 * (Netlify functions run on AWS Lambda) have no writable disk worth logging to; their
 * platform keeps stdout, so writing a file there is skipped even if LOG_DIR is set.
 */
export function fileLoggingDir(env: Record<string, string | undefined> = process.env): string | null {
  if (env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME) return null;
  return env.LOG_DIR || null;
}

function appendToFile(entry: string): void {
  const logDir = fileLoggingDir();
  if (!logDir) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    fs.appendFileSync(`${logDir}/app.log`, entry + "\n");
  } catch {
    // Edge Runtime or unwritable LOG_DIR — silently skip
  }
}

export function createLogger(module: string) {
  function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (LEVELS[level] < LEVELS[getConfiguredLevel()]) return;

    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      module,
      message,
      ...data,
    });

    console.log(entry);
    appendToFile(entry);
  }

  return {
    debug: (message: string, data?: Record<string, unknown>) => log("debug", message, data),
    info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
  };
}
