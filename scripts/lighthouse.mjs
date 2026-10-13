// Runs Lighthouse against a deployed site and reports median scores.
// usage: node scripts/lighthouse.mjs https://lendlot.vercel.app [runs]
// Writes HTML/JSON reports to ./lighthouse-reports and, in GitHub Actions,
// a summary table plus one ::notice:: annotation per page/preset.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [base = "https://lendlot.vercel.app", runsArg = "3"] = process.argv.slice(2);
const RUNS = Number(runsArg);
const PAGES = { Catalogue: "/", "Item page": "/items/cordless-drill-driver-kit" };
const PRESETS = ["mobile", "desktop"];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const OUT = path.resolve("lighthouse-reports");
fs.mkdirSync(OUT, { recursive: true });

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rows = [];

for (const [page, route] of Object.entries(PAGES)) {
  for (const preset of PRESETS) {
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      const file = path.join(OUT, `${page.replace(/\W+/g, "-").toLowerCase()}-${preset}-${i}`);
      execFileSync(
        "npx",
        [
          "--yes",
          "lighthouse@12",
          base + route,
          ...(preset === "desktop" ? ["--preset=desktop"] : []),
          `--only-categories=${CATEGORIES.join(",")}`,
          "--chrome-flags=--headless=new --no-sandbox",
          "--output=json",
          "--output=html",
          `--output-path=${file}`,
          "--quiet",
        ],
        { stdio: "inherit", shell: process.platform === "win32" },
      );
      runs.push(JSON.parse(fs.readFileSync(`${file}.report.json`, "utf8")));
    }
    const score = (category) => median(runs.map((r) => Math.round(r.categories[category].score * 100)));
    const metric = (id) => median(runs.map((r) => r.audits[id].numericValue));
    rows.push({
      page,
      preset,
      scores: CATEGORIES.map(score),
      lcp: (metric("largest-contentful-paint") / 1000).toFixed(1),
      tbt: Math.round(metric("total-blocking-time")),
      cls: metric("cumulative-layout-shift").toFixed(3),
    });
  }
}

const table = [
  "| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map(
    (r) => `| ${r.page} | ${r.preset} | ${r.scores.join(" | ")} | ${r.lcp} s | ${r.tbt} ms | ${r.cls} |`,
  ),
].join("\n");

console.log(`\nLighthouse 12, median of ${RUNS} runs — ${base}\n\n${table}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Lighthouse (median of ${RUNS} runs)\n\n${base}\n\n${table}\n`);
  for (const r of rows) {
    console.log(`::notice title=Lighthouse ${r.page} (${r.preset})::${CATEGORIES.map((c, i) => `${c} ${r.scores[i]}`).join(", ")}; LCP ${r.lcp}s, TBT ${r.tbt}ms, CLS ${r.cls}`);
  }
}
