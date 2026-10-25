// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPasswordOrDummy } from "./password";

describe("verifyPasswordOrDummy", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPasswordOrDummy("correct horse battery", stored)).toBe(true);
    expect(await verifyPasswordOrDummy("wrong", stored)).toBe(false);
  });

  it("rejects unknown accounts after doing comparable scrypt work", async () => {
    const stored = await hashPassword("correct horse battery");
    const time = async (fn: () => Promise<unknown>) => {
      const start = performance.now();
      await fn();
      return performance.now() - start;
    };
    await verifyPasswordOrDummy("warm-up", null); // first call also builds the dummy hash
    const unknown = await time(() => verifyPasswordOrDummy("guess", null));
    const known = await time(() => verifyPasswordOrDummy("guess", stored));
    expect(await verifyPasswordOrDummy("guess", undefined)).toBe(false);
    // Not a precise timing test (machines are noisy): just proves scrypt ran.
    expect(unknown).toBeGreaterThan(known / 5);
  });
});
