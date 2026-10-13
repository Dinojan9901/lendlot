import { execSync } from "node:child_process";

/** Fresh, seeded database for every E2E run so tests are repeatable. */
export default function globalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://lendlot:lendlot@localhost:5433/lendlot_test",
  };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx prisma db seed", { stdio: "inherit", env });
}
