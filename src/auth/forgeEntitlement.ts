export type ForgeEntitlementView = {
  entitled: boolean;
  planId: string;
  reasonCode: string;
  expiresAt: string | null;
};

/** Read the server entitlement object. A client-supplied entitled flag is ignored. */
export function readForgeEntitlement(payload: unknown): ForgeEntitlementView | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { forgeEntitlement?: unknown }).forgeEntitlement;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.entitled !== "boolean" || typeof row.reasonCode !== "string") return null;
  return {
    entitled: row.entitled,
    planId: typeof row.planId === "string" ? row.planId : "free",
    reasonCode: row.reasonCode,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null
  };
}
