/**
 * Prefer the API JSON `error` field (409 / 5xx / 4xx); fall back only when absent.
 */
export async function readApiError(
  res: Response,
  fallback: string
): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Non-JSON body
  }
  return fallback;
}
