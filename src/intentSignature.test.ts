import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import test from "node:test";
import { IntentSignatureVerifier, SensitiveIntentName } from "./intentSignature.js";

function sign(
  key: string,
  intent: SensitiveIntentName,
  timestamp: number,
  nonce: string,
  payload: unknown
): string {
  const bodyHash = createHash("sha256")
    .update(JSON.stringify(payload ?? {}))
    .digest("hex");
  const material = `${intent}|${String(timestamp)}|${nonce}|${bodyHash}`;
  return createHmac("sha256", key).update(material).digest("hex");
}

test("intent signature verifier allows requests when disabled", () => {
  const verifier = new IntentSignatureVerifier(undefined);
  const out = verifier.verifyIntent({
    intent: "forge.mode.set",
    payload: { mode: "strict" }
  });
  assert.deepEqual(out, { ok: true, reason: "disabled" });
  const status = verifier.getStatus();
  assert.equal(status.counters.disabled, 1);
});

test("intent signature verifier validates signed request and blocks replay", () => {
  const key = "test-signing-key";
  const verifier = new IntentSignatureVerifier(key);
  const now = 1_000_000;
  const payload = { mode: "strict" };
  const signature = sign(key, "forge.mode.set", now, "n1", payload);
  const first = verifier.verifyIntent({
    intent: "forge.mode.set",
    payload,
    signature,
    timestamp: String(now),
    nonce: "n1",
    now
  });
  assert.deepEqual(first, { ok: true, reason: "verified" });
  const second = verifier.verifyIntent({
    intent: "forge.mode.set",
    payload,
    signature,
    timestamp: String(now),
    nonce: "n1",
    now: now + 1
  });
  assert.equal(second.ok, false);
  const status = verifier.getStatus();
  assert.equal(status.counters.verified, 1);
  assert.equal(status.counters.nonce_replay, 1);
  assert.ok(status.lastFailureAt);
});

test("intent signature verifier rejects invalid timestamp skew", () => {
  const key = "test-signing-key";
  const verifier = new IntentSignatureVerifier(key, { maxSkewMs: 1000 });
  const payload = { enabled: true };
  const signature = sign(key, "forge.lockdown.toggle", 5000, "n2", payload);
  const out = verifier.verifyIntent({
    intent: "forge.lockdown.toggle",
    payload,
    signature,
    timestamp: "5000",
    nonce: "n2",
    now: 7005
  });
  assert.equal(out.ok, false);
  const status = verifier.getStatus();
  assert.equal(status.counters.timestamp_skew, 1);
});

test("intent signature verifier accepts secondary key during grace window", () => {
  const now = 2_000_000;
  const verifier = new IntentSignatureVerifier({
    primaryKey: "primary-key",
    secondaryKey: "secondary-key",
    secondaryGraceUntilMs: now + 1000
  });
  const payload = { mode: "adaptive" };
  const signature = sign("secondary-key", "forge.mode.set", now, "n3", payload);
  const out = verifier.verifyIntent({
    intent: "forge.mode.set",
    payload,
    signature,
    timestamp: String(now),
    nonce: "n3",
    now
  });
  assert.equal(out.ok, true);
  const status = verifier.getStatus();
  assert.equal(status.keyRotation.secondaryConfigured, true);
  assert.equal(status.counters.verified_secondary, 1);
});

test("intent signature verifier rejects secondary key after grace expiry", () => {
  const now = 3_000_000;
  const verifier = new IntentSignatureVerifier({
    primaryKey: "primary-key",
    secondaryKey: "secondary-key",
    secondaryGraceUntilMs: now - 1
  });
  const payload = { mode: "adaptive" };
  const signature = sign("secondary-key", "forge.mode.set", now, "n4", payload);
  const out = verifier.verifyIntent({
    intent: "forge.mode.set",
    payload,
    signature,
    timestamp: String(now),
    nonce: "n4",
    now
  });
  assert.equal(out.ok, false);
});
