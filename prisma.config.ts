import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrations) needs a direct connection; on Neon the app itself uses
// the pooled DATABASE_URL, and the direct one is DATABASE_URL_UNPOOLED.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` (run on npm install) doesn't need a database, so only
  // require the URL for commands that actually connect (migrate, seed, ...).
  ...(url ? { datasource: { url } } : {}),
});
