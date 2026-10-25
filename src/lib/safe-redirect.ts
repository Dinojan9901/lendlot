const PLACEHOLDER_ORIGIN = "https://lendlot.invalid";

/**
 * Returns `value` if it is a same-site relative path, otherwise `fallback`.
 * Rejects absolute URLs, protocol-relative "//evil.com", the "/\evil.com"
 * trick (browsers treat "\" like "/"), and control characters, so a
 * callbackUrl/returnTo parameter can't be used as an open redirect.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f]/.test(value)) return fallback;
  const url = new URL(value, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
