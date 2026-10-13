import { describe, expect, it } from "vitest";
import { signPaddlePayload, verifyPaddleSignature } from "./paddle";

const SECRET = "pdl_ntfset_test_secret";
const BODY = '{"event_id":"evt_1","event_type":"subscription.created"}';
const NOW = 1_791_900_000_000;
const ts = NOW / 1000;

describe("verifyPaddleSignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyPaddleSignature(BODY, signPaddlePayload(BODY, SECRET, ts), SECRET, { now: NOW })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = signPaddlePayload(BODY, SECRET, ts);
    expect(verifyPaddleSignature(BODY.replace("created", "canceled"), header, SECRET, { now: NOW })).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(verifyPaddleSignature(BODY, signPaddlePayload(BODY, "pdl_ntfset_other", ts), SECRET, { now: NOW })).toBe(false);
  });

  it("rejects old timestamps (replays)", () => {
    const header = signPaddlePayload(BODY, SECRET, ts - 600);
    expect(verifyPaddleSignature(BODY, header, SECRET, { now: NOW })).toBe(false);
  });

  it.each(["", "ts=abc;h1=00", "h1=deadbeef", `ts=${ts}`])("rejects malformed header %j", (header) => {
    expect(verifyPaddleSignature(BODY, header, SECRET, { now: NOW })).toBe(false);
  });

  it("accepts any matching h1 while a secret is being rotated", () => {
    const valid = signPaddlePayload(BODY, SECRET, ts).split(";")[1];
    expect(verifyPaddleSignature(BODY, `ts=${ts};h1=${"0".repeat(64)};${valid}`, SECRET, { now: NOW })).toBe(true);
  });
});
