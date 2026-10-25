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
const ATTEMPTS = 3;

/**
 * One Lighthouse run, retried: Chrome occasionally fails to record its trace
 * (NO_NAVSTART, NO_FCP…), which says nothing about the site. Returns null if
 * every attempt fails.
 */
function audit(url, preset, file) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      execFileSync(
        "npx",
        [
          "--yes",
          "lighthouse@12",
          url,
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
      const report = JSON.parse(fs.readFileSync(`${file}.report.json`, "utf8"));
      if (!report.runtimeError) return report;
      console.warn(`Lighthouse runtime error (${report.runtimeError.code}), attempt ${attempt}/${ATTEMPTS}`);
    } catch (error) {
      console.warn(`Lighthouse run failed for ${url} (${preset}), attempt ${attempt}/${ATTEMPTS}: ${error.message.split("\n")[0]}`);
    }
  }
  return null;
}

for (const [page, route] of Object.entries(PAGES)) {
  for (const preset of PRESETS) {
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      const file = path.join(OUT, `${page.replace(/\W+/g, "-").toLowerCase()}-${preset}-${i}`);
      const report = audit(base + route, preset, file);
      if (report) runs.push(report);
    }
    // A page is only a failure if no run at all succeeded; otherwise use the median of the good runs.
    if (runs.length === 0) throw new Error(`Lighthouse failed every attempt for ${page} (${preset})`);
    const score = (category) => median(runs.map((r) => Math.round(r.categories[category].score * 100)));
    const metric = (id) => median(runs.map((r) => r.audits[id].numericValue));
    rows.push({
      page,
      preset,
      scores: CATEGORIES.map(score),
      lcp: (metric("largest-contentful-paint") / 1000).toFixed(1),
      tbt: Math.round(metric("total-blocking-time")),
      cls: metric("cumulative-layout-shift").toFixed(3),
      runs: runs.length,
    });
  }
}

const table = [
  "| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS | Runs |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map(
    (r) => `| ${r.page} | ${r.preset} | ${r.scores.join(" | ")} | ${r.lcp} s | ${r.tbt} ms | ${r.cls} | ${r.runs}/${RUNS} |`,
  ),
].join("\n");

console.log(`\nLighthouse 12, median of up to ${RUNS} runs — ${base}\n\n${table}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Lighthouse (median of up to ${RUNS} runs)\n\n${base}\n\n${table}\n`);
  for (const r of rows) {
    console.log(`::notice title=Lighthouse ${r.page} (${r.preset})::${CATEGORIES.map((c, i) => `${c} ${r.scores[i]}`).join(", ")}; LCP ${r.lcp}s, TBT ${r.tbt}ms, CLS ${r.cls} (${r.runs}/${RUNS} runs)`);
  }
}
