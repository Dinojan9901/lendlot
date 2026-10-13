/**
 * Generates the illustrated cover images in public/items/ for the seed data.
 * Run with: npm run images
 *
 * Generated art (instead of stock photos) keeps the repo free of licensing
 * questions and brand logos, and works offline in CI. Output is WebP, which
 * next/image then resizes per device.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { items } from "../prisma/seed-data";

const WIDTH = 1200;
const HEIGHT = 800;
const OUT_DIR = path.join(process.cwd(), "public", "items");

const palette: Record<string, [string, string]> = {
  tools: ["#9a3412", "#ea580c"],
  outdoors: ["#14532d", "#4d7c0f"],
  photo: ["#1e3a8a", "#4338ca"],
  events: ["#831843", "#9333ea"],
  sports: ["#164e63", "#0369a1"],
  music: ["#78350f", "#d97706"],
};

// 200×200 icons drawn in white; "BG" is replaced with the darker category colour.
const icons: Record<string, string> = {
  tools: `
    <g transform="rotate(-35 100 100)">
      <rect x="88" y="78" width="24" height="110" rx="10" fill="#fff"/>
      <rect x="45" y="30" width="110" height="52" rx="12" fill="#fff"/>
      <rect x="45" y="44" width="22" height="24" fill="BG" opacity="0.35"/>
    </g>`,
  outdoors: `
    <circle cx="160" cy="42" r="18" fill="#fff" opacity="0.85"/>
    <path d="M100 38 L182 172 H18 Z" fill="#fff" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>
    <path d="M100 96 L128 172 H72 Z" fill="BG"/>
    <path d="M92 26 L108 52" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  photo: `
    <rect x="72" y="40" width="56" height="30" rx="8" fill="#fff"/>
    <rect x="22" y="58" width="156" height="108" rx="22" fill="#fff"/>
    <circle cx="100" cy="112" r="40" fill="BG"/>
    <circle cx="100" cy="112" r="26" fill="#fff"/>
    <circle cx="100" cy="112" r="12" fill="BG"/>
    <circle cx="152" cy="80" r="7" fill="BG"/>`,
  events: `
    <path d="M10 46 Q100 110 190 46" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
    <g fill="#fff">
      <rect x="38" y="64" width="12" height="14" rx="3"/><circle cx="44" cy="96" r="18"/>
      <rect x="94" y="77" width="12" height="14" rx="3"/><circle cx="100" cy="110" r="20"/>
      <rect x="150" y="64" width="12" height="14" rx="3"/><circle cx="156" cy="96" r="18"/>
    </g>
    <g fill="#fff" opacity="0.6">
      <circle cx="30" cy="150" r="6"/><circle cx="72" cy="166" r="5"/><circle cx="128" cy="160" r="6"/><circle cx="172" cy="148" r="5"/>
    </g>`,
  sports: `
    <g fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="50" cy="128" r="36"/>
      <circle cx="150" cy="128" r="36"/>
      <path d="M50 128 L82 72 H138 L150 128 M82 72 L104 128 H50 M138 72 L104 128"/>
      <path d="M70 56 H96 M126 56 L138 72 M128 50 H148"/>
    </g>`,
  music: `
    <g fill="#fff">
      <path d="M70 52 L160 32 V60 L70 80 Z"/>
      <rect x="62" y="56" width="12" height="100" rx="4"/>
      <rect x="152" y="36" width="12" height="100" rx="4"/>
      <ellipse cx="52" cy="156" rx="26" ry="20" transform="rotate(-20 52 156)"/>
      <ellipse cx="142" cy="136" rx="26" ry="20" transform="rotate(-20 142 136)"/>
    </g>`,
};

/** Small deterministic hash so each item gets its own variation. */
function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

function renderSvg(slug: string, category: string): string {
  const [dark, light] = palette[category];
  const seed = hash(slug);
  const angle = seed % 360;
  const offset = seed % 60;
  const iconX = WIDTH / 2 - 210 + ((seed >> 8) % 120) - 60;
  const icon = icons[category].replaceAll("BG", dark);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" gradientTransform="rotate(${angle % 90} 0.5 0.5)">
        <stop offset="0" stop-color="${dark}"/>
        <stop offset="1" stop-color="${light}"/>
      </linearGradient>
      <pattern id="dots" width="60" height="60" patternUnits="userSpaceOnUse" x="${offset}" y="${offset}">
        <circle cx="30" cy="30" r="3" fill="#fff" opacity="0.14"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect width="100%" height="100%" fill="url(#dots)"/>
    <circle cx="${iconX + 210}" cy="400" r="290" fill="#fff" opacity="0.08"/>
    <g transform="translate(${iconX} 190) scale(2.1)">${icon}</g>
  </svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv.slice(2);
  for (const item of items) {
    if (only.length && !only.includes(item.slug) && !only.includes(item.category)) continue;
    const file = path.join(OUT_DIR, `${item.slug}.webp`);
    await sharp(Buffer.from(renderSvg(item.slug, item.category)))
      .webp({ quality: 82 })
      .toFile(file);
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
