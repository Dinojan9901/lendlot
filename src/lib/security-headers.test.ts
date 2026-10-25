import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const production = { isDev: false, upgradeInsecureRequests: true };

function directive(csp: string, name: string): string[] {
  const found = csp.split("; ").find((d) => d.split(" ")[0] === name);
  return found ? found.split(" ").slice(1) : [];
}

describe("securityHeaders", () => {
  const headers = Object.fromEntries(securityHeaders(production).map((h) => [h.key, h.value]));

  it("sets every required header", () => {
    expect(Object.keys(headers)).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
      ]),
    );
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d{8,}; includeSubDomains/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("contentSecurityPolicy", () => {
  const csp = contentSecurityPolicy(production);

  it("forbids framing, plugins and base-tag hijacking", () => {
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(directive(csp, "default-src")).toEqual(["'self'"]);
  });

  it("allows Paddle's script, styles and checkout frame, and nothing else external", () => {
    expect(directive(csp, "script-src")).toEqual(["'self'", "'unsafe-inline'", "https://cdn.paddle.com"]);
    expect(directive(csp, "frame-src")).toEqual(["https://buy.paddle.com", "https://sandbox-buy.paddle.com"]);
    expect(directive(csp, "style-src")).toContain("https://sandbox-cdn.paddle.com");
    expect(directive(csp, "connect-src")).toEqual(["'self'"]);
  });

  it("never allows eval in production, and upgrades insecure requests only when asked", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
    const local = contentSecurityPolicy({ isDev: true, upgradeInsecureRequests: false });
    expect(local).toContain("'unsafe-eval'");
    expect(local).not.toContain("upgrade-insecure-requests");
  });
});
