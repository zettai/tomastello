import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Fixed 400 body for failed input validation (no Zod detail leakage). */
export const INVALID_REQUEST = { error: "Invalid request" } as const;

export function invalidRequestResponse(): NextResponse {
  return NextResponse.json(INVALID_REQUEST, { status: 400 });
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/** Parses `input` with `schema`; on failure returns a 400 Invalid request response. */
export function parseWithSchema<T>(schema: ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { ok: false, response: invalidRequestResponse() };
  }
  return { ok: true, data: result.data };
}

/** Reads JSON from the request body and validates with `schema`. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: invalidRequestResponse() };
  }
  return parseWithSchema(schema, raw);
}

/** Builds a plain object from selected query keys (missing keys become `null`). */
export function searchParamsRecord(
  searchParams: URLSearchParams,
  keys: readonly string[]
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of keys) {
    out[key] = searchParams.get(key);
  }
  return out;
}

/** Validates query string fields listed in `keys`. */
export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodType<T>,
  keys: readonly string[]
): ParseResult<T> {
  return parseWithSchema(schema, searchParamsRecord(searchParams, keys));
}

/** Validates dynamic route params (e.g. `{ id: string }`). */
export function parseParams<T>(params: unknown, schema: ZodType<T>): ParseResult<T> {
  return parseWithSchema(schema, params);
}

/** Validates selected entries from `FormData` via a schema over a plain object. */
export async function parseFormData<T>(
  request: Request,
  schema: ZodType<T>,
  buildInput: (formData: FormData) => unknown
): Promise<ParseResult<T>> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { ok: false, response: invalidRequestResponse() };
  }
  return parseWithSchema(schema, buildInput(formData));
}
