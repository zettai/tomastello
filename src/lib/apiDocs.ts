type Env = Record<string, string | undefined>;

/**
 * Whether /swagger and /api/swagger are served. Off in production unless ENABLE_API_DOCS=true:
 * the spec is built by scanning src/app/api at runtime, and the production image doesn't ship
 * the source, so there it would document almost nothing (and point at localhost).
 */
export function apiDocsEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" || env.ENABLE_API_DOCS === "true";
}
