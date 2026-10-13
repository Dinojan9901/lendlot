import { execSync } from "node:child_process";

/** Bring the test database schema up to date once before the integration run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://lendlot:lendlot@localhost:5433/lendlot_test";
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
