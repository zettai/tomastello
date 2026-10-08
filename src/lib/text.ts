const FORBIDDEN_IN_STRICT_EMAIL = new Set(["<", ">", "(", ")", "[", "]", "\\", ",", ";", ":", '"']);

/** Pragmatic email shape check without regex backtracking hotspots. */
export function isEmailLike(value: string, options: { strict?: boolean } = {}): boolean {
  for (const ch of value) {
    if (/\s/.test(ch)) return false;
    if (options.strict && FORBIDDEN_IN_STRICT_EMAIL.has(ch)) return false;
  }
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  if (dot < 1) return false;
  const tail = domain.length - dot - 1;
  return options.strict ? tail >= 2 : tail >= 1;
}
