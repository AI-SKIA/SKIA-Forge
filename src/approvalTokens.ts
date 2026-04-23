import crypto from "node:crypto";

type TokenRow = {
  expiresAt: number;
  purpose: ApprovalTokenPurpose;
};

export type ApprovalTokenPurpose = "any" | "module" | "orchestration" | "remediation";

export class ApprovalTokenStore {
  private readonly rows = new Map<string, TokenRow>();
  private readonly issuedByPurpose = new Map<ApprovalTokenPurpose, number>();
  private readonly consumedByPurpose = new Map<Exclude<ApprovalTokenPurpose, "any">, number>();
  private rejected = 0;
  private expired = 0;

  constructor(private readonly ttlMs: number) {}

  issue(purpose: ApprovalTokenPurpose = "any"): { token: string; expiresAt: string; purpose: ApprovalTokenPurpose } {
    this.prune();
    const token = crypto.randomBytes(18).toString("base64url");
    const expiresAt = Date.now() + this.ttlMs;
    this.rows.set(token, { expiresAt, purpose });
    this.issuedByPurpose.set(purpose, (this.issuedByPurpose.get(purpose) ?? 0) + 1);
    return {
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      purpose
    };
  }

  consume(token: string, purpose: Exclude<ApprovalTokenPurpose, "any">): boolean {
    this.prune();
    const row = this.rows.get(token);
    if (!row) {
      this.rejected += 1;
      return false;
    }
    if (row.purpose !== "any" && row.purpose !== purpose) {
      this.rejected += 1;
      return false;
    }
    this.rows.delete(token);
    const ok = row.expiresAt > Date.now();
    if (!ok) {
      this.expired += 1;
      return false;
    }
    this.consumedByPurpose.set(purpose, (this.consumedByPurpose.get(purpose) ?? 0) + 1);
    return true;
  }

  getStats() {
    return {
      active: this.rows.size,
      issuedByPurpose: {
        any: this.issuedByPurpose.get("any") ?? 0,
        module: this.issuedByPurpose.get("module") ?? 0,
        orchestration: this.issuedByPurpose.get("orchestration") ?? 0,
        remediation: this.issuedByPurpose.get("remediation") ?? 0
      },
      consumedByPurpose: {
        module: this.consumedByPurpose.get("module") ?? 0,
        orchestration: this.consumedByPurpose.get("orchestration") ?? 0,
        remediation: this.consumedByPurpose.get("remediation") ?? 0
      },
      rejected: this.rejected,
      expired: this.expired
    };
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, row] of this.rows.entries()) {
      if (row.expiresAt <= now) {
        this.rows.delete(token);
        this.expired += 1;
      }
    }
  }
}
