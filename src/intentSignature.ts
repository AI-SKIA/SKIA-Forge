import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export type SensitiveIntentName =
  | "forge.mode.set"
  | "forge.lockdown.toggle"
  | "forge.control_plane.remediate"
  | "forge.control_plane.remediate.recommended"
  | "forge.approval_token.issue"
  | "forge.governance.reload"
  | "forge.index.rebuild"
  | "forge.skia.review";

export type IntentVerificationResult =
  | { ok: true; reason: "verified" | "disabled" }
  | { ok: false; reason: string };

type IntentVerificationCounterKey =
  | "verified"
  | "disabled"
  | "missing_headers"
  | "invalid_timestamp"
  | "timestamp_skew"
  | "nonce_replay"
  | "signature_mismatch"
  | "verified_secondary";

type NonceRecord = {
  expiresAt: number;
};

export class IntentSignatureVerifier {
  private readonly primaryKey: string | null;
  private readonly secondaryKey: string | null;
  private readonly secondaryGraceUntilMs: number | null;
  private readonly maxSkewMs: number;
  private readonly nonceTtlMs: number;
  private readonly nonceStore = new Map<string, NonceRecord>();
  private readonly counters: Record<IntentVerificationCounterKey, number> = {
    verified: 0,
    disabled: 0,
    missing_headers: 0,
    invalid_timestamp: 0,
    timestamp_skew: 0,
    nonce_replay: 0,
    signature_mismatch: 0,
    verified_secondary: 0
  };
  private lastFailureAt: string | null = null;

  constructor(
    keyOrConfig:
      | string
      | null
      | undefined
      | {
          primaryKey?: string | null;
          secondaryKey?: string | null;
          secondaryGraceUntilMs?: number | null;
        },
    options?: {
      maxSkewMs?: number;
      nonceTtlMs?: number;
    }
  ) {
    if (typeof keyOrConfig === "object" && keyOrConfig !== null) {
      this.primaryKey =
        typeof keyOrConfig.primaryKey === "string" && keyOrConfig.primaryKey.trim()
          ? keyOrConfig.primaryKey
          : null;
      this.secondaryKey =
        typeof keyOrConfig.secondaryKey === "string" && keyOrConfig.secondaryKey.trim()
          ? keyOrConfig.secondaryKey
          : null;
      this.secondaryGraceUntilMs =
        typeof keyOrConfig.secondaryGraceUntilMs === "number" &&
        Number.isFinite(keyOrConfig.secondaryGraceUntilMs)
          ? keyOrConfig.secondaryGraceUntilMs
          : null;
    } else {
      this.primaryKey = typeof keyOrConfig === "string" && keyOrConfig.trim() ? keyOrConfig : null;
      this.secondaryKey = null;
      this.secondaryGraceUntilMs = null;
    }
    this.maxSkewMs = options?.maxSkewMs ?? 5 * 60_000;
    this.nonceTtlMs = options?.nonceTtlMs ?? 10 * 60_000;
  }

  getStatus(): {
    enabled: boolean;
    keyRotation: {
      secondaryConfigured: boolean;
      secondaryGraceActive: boolean;
      secondaryGraceUntil: string | null;
    };
    maxSkewMs: number;
    nonceTtlMs: number;
    activeNonces: number;
    counters: Record<IntentVerificationCounterKey, number>;
    lastFailureAt: string | null;
  } {
    this.sweepExpired(Date.now());
    return {
      enabled: this.primaryKey !== null,
      keyRotation: {
        secondaryConfigured: this.secondaryKey !== null,
        secondaryGraceActive: this.isSecondaryGraceActive(Date.now()),
        secondaryGraceUntil:
          this.secondaryGraceUntilMs === null ? null : new Date(this.secondaryGraceUntilMs).toISOString()
      },
      maxSkewMs: this.maxSkewMs,
      nonceTtlMs: this.nonceTtlMs,
      activeNonces: this.nonceStore.size,
      counters: { ...this.counters },
      lastFailureAt: this.lastFailureAt
    };
  }

  verifyIntent(input: {
    intent: SensitiveIntentName;
    payload: unknown;
    signature?: string;
    timestamp?: string;
    nonce?: string;
    now?: number;
  }): IntentVerificationResult {
    if (!this.primaryKey) {
      this.counters.disabled += 1;
      return { ok: true, reason: "disabled" };
    }
    const now = input.now ?? Date.now();
    this.sweepExpired(now);
    if (!input.signature || !input.timestamp || !input.nonce) {
      this.trackFailure("missing_headers");
      return { ok: false, reason: "Missing signature headers." };
    }
    const ts = Number(input.timestamp);
    if (!Number.isFinite(ts)) {
      this.trackFailure("invalid_timestamp");
      return { ok: false, reason: "Invalid signature timestamp." };
    }
    if (Math.abs(now - ts) > this.maxSkewMs) {
      this.trackFailure("timestamp_skew");
      return { ok: false, reason: "Signature timestamp outside allowed skew." };
    }
    const nonceKey = `${input.intent}:${input.nonce}`;
    if (this.nonceStore.has(nonceKey)) {
      this.trackFailure("nonce_replay");
      return { ok: false, reason: "Signature nonce already used." };
    }
    const bodyHash = createHash("sha256")
      .update(JSON.stringify(input.payload ?? {}))
      .digest("hex");
    const material = `${input.intent}|${String(ts)}|${input.nonce}|${bodyHash}`;
    const expectedPrimary = createHmac("sha256", this.primaryKey).update(material).digest("hex");
    if (safeHexEqual(expectedPrimary, input.signature)) {
      this.nonceStore.set(nonceKey, { expiresAt: now + this.nonceTtlMs });
      this.counters.verified += 1;
      return { ok: true, reason: "verified" };
    }
    if (this.secondaryKey && this.isSecondaryGraceActive(now)) {
      const expectedSecondary = createHmac("sha256", this.secondaryKey).update(material).digest("hex");
      if (safeHexEqual(expectedSecondary, input.signature)) {
        this.nonceStore.set(nonceKey, { expiresAt: now + this.nonceTtlMs });
        this.counters.verified += 1;
        this.counters.verified_secondary += 1;
        return { ok: true, reason: "verified" };
      }
    }
    {
      this.trackFailure("signature_mismatch");
      return { ok: false, reason: "Signature mismatch." };
    }
  }

  private trackFailure(key: Exclude<IntentVerificationCounterKey, "verified" | "disabled">): void {
    this.counters[key] += 1;
    this.lastFailureAt = new Date().toISOString();
  }

  private sweepExpired(now: number): void {
    for (const [key, row] of this.nonceStore.entries()) {
      if (row.expiresAt <= now) {
        this.nonceStore.delete(key);
      }
    }
  }

  private isSecondaryGraceActive(now: number): boolean {
    if (!this.secondaryKey) {
      return false;
    }
    if (this.secondaryGraceUntilMs === null) {
      return true;
    }
    return now <= this.secondaryGraceUntilMs;
  }
}

function safeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
