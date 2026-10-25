# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report them privately through GitHub: on this repository, go to **Security → Advisories → Report a vulnerability** ([private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)). Include:

- what you found and where (URL, endpoint or file),
- steps to reproduce, and
- the impact you think it has.

You can expect an acknowledgement within 7 days. Please give me a reasonable time to fix the issue before disclosing it. Lendlot is a portfolio project: there is no bug bounty, but valid reports are credited in the fix.

**In scope:** the code in this repository and the deployment at https://lendlot.vercel.app.
**Out of scope:** denial-of-service by volume, findings that need a compromised device or browser, and the third-party services themselves (Vercel, Neon, Paddle, Upstash). Payments run in Paddle's sandbox only, so no real card data is ever processed.

## Supported versions

Only the latest commit on `main` (which is what is deployed) receives fixes.

## Automated checks

Every push and pull request runs:

| Check | What it looks for | Where |
| --- | --- | --- |
| **CodeQL** (`security-extended` queries) | Injection, XSS, open redirects, insecure crypto, unsafe regular expressions… in the JavaScript/TypeScript code. Also runs weekly. | [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml) |
| **Trivy** (`trivy fs`) | Known-vulnerable dependencies, committed secrets, and misconfigurations (e.g. Docker/Compose). Fails on HIGH or CRITICAL. Accepted exceptions must be listed in [`.trivyignore`](.trivyignore) with a reason and an expiry date. | `security-scan` job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| **npm audit** | Vulnerable production dependencies (HIGH and above). | same job |
| **Dependabot** | Weekly update PRs for npm packages and GitHub Actions (minor/patch grouped), plus immediate security updates. | [`.github/dependabot.yml`](.github/dependabot.yml) |
| **Tests** | Authorization, rate limiting (429 + `Retry-After`), webhook signature verification and idempotency, security headers, and an end-to-end check that the main pages run without Content-Security-Policy violations. | `quality`, `integration` and `e2e` jobs |

Workflows run with a read-only `GITHUB_TOKEN` by default. Trivy is downloaded from its official release and checked against a pinned SHA-256 checksum instead of using a third-party action.
