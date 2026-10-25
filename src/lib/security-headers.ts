/**
 * HTTP security headers for every response (applied in next.config.ts).
 *
 * Why the CSP is static rather than nonce-based: a nonce must be generated per
 * request, which forces every page to render dynamically. Next.js documents
 * that this disables static rendering, ISR and Partial Prerendering, which the
 * catalogue and item pages depend on. So scripts are limited to this origin
 * plus Paddle's CDN, and 'unsafe-inline' is allowed only for the inline
 * bootstrap scripts and styles Next.js itself emits. Everything else (objects,
 * base URI, form targets, framing, connections) is locked down.
 */

/** Origins the top-level page really loads from (measured during a sandbox checkout). */
const PADDLE = {
  script: ["https://cdn.paddle.com"],
  style: ["https://cdn.paddle.com", "https://sandbox-cdn.paddle.com"],
  frame: ["https://buy.paddle.com", "https://sandbox-buy.paddle.com"],
  // "Manage subscription" redirects to Paddle's customer portal after a form post.
  formAction: ["https://customer-portal.paddle.com", "https://sandbox-customer-portal.paddle.com"],
};

type Options = { isDev: boolean; upgradeInsecureRequests: boolean };

export function contentSecurityPolicy({ isDev, upgradeInsecureRequests }: Options): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval only in development (for error stack reconstruction).
    "script-src": ["'self'", "'unsafe-inline'", ...PADDLE.script, ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", ...PADDLE.style],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "frame-src": PADDLE.frame,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...PADDLE.formAction],
    "frame-ancestors": ["'none'"],
    ...(upgradeInsecureRequests ? { "upgrade-insecure-requests": [] } : {}),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

export function securityHeaders(options: Options): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    // Two years, including subdomains. Browsers ignore it over plain http (local dev).
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Legacy equivalent of frame-ancestors 'none' for older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "usb=()",
        "browsing-topics=()",
        // Wallet payments inside Paddle's checkout iframe.
        `payment=(self ${PADDLE.frame.map((origin) => `"${origin}"`).join(" ")})`,
      ].join(", "),
    },
    // Isolate the browsing context group, but keep popups (e.g. PayPal in checkout) working.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}
