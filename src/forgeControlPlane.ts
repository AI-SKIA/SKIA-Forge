import { randomUUID } from "crypto";
import { AgentAuditLogRecord } from "./types.js";
import { ForgeGovernancePolicy } from "./forgePolicy.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";
import { buildControlPlaneAlerts } from "./forgeControlPlaneAlerts.js";
import { buildControlPlaneRecommendations } from "./forgeControlPlaneRecommendations.js";

/**
 * Skia-FULL `AdversaryEvent` shape (duplicated here so Forge can compile without importing
 * `../../Skia-FULL/...`, which violates TS `rootDir` for this package).
 */
type EpaasAdversaryEvent = {
  eventId: string;
  sessionId?: string;
  userId?: string;
  ip?: string;
  asn?: string;
  deviceFingerprint?: string;
  eventType:
    | "high_risk_session"
    | "decoy_interaction"
    | "honey_trigger"
    | "alias_misuse"
    | "token_misuse"
    | "suspicious_traversal";
  riskBandAtEvent: "low" | "medium" | "high" | "critical";
  detail: Record<string, unknown>;
  timestamp: Date;
};

const forgeAdversaryIngestBuffer: EpaasAdversaryEvent[] = [];

/**
 * Mirrors Skia-FULL `adversaryTelemetryService.ingest()` from `AdversaryTelemetryService.ts` —
 * in-memory buffer only; Forge cannot bundle Skia-FULL `AuditService` / `logger` transitive graph under TS6059.
 */
const adversaryTelemetryService = {
  ingest(event: EpaasAdversaryEvent): void {
    forgeAdversaryIngestBuffer.push(event);
  }
};

export function buildControlPlaneSnapshot(input: {
  mode: SovereignExecutionMode;
  lockdown?: boolean;
  policy: ForgeGovernancePolicy;
  telemetry: Record<string, unknown>;
  approvalTokens?: Record<string, unknown>;
  intents?: Record<string, unknown>;
  auditRows: AgentAuditLogRecord[];
  recentLimit?: number;
  emitAdversaryEvent?: (event: {
    eventType: string;
    detail: Record<string, unknown>;
    timestamp: string;
  }) => void;
}) {
  const recentLimit = input.recentLimit ?? 20;
  const governanceAudit = input.auditRows
    .filter((row) => row.action.startsWith("forge."))
    .slice(-recentLimit)
    .map((row) => ({
      timestamp: row.timestamp,
      action: row.action,
      result: row.result,
      details: row.details
    }));

  const alerts = buildControlPlaneAlerts(
    input.mode,
    input.policy,
    input.telemetry as {
      totalDecisions: number;
      byDecision?: { allowed?: number; blocked?: number };
    },
    input.intents as
      | {
          enabled?: boolean;
          keyRotation?: {
            secondaryConfigured?: boolean;
            secondaryGraceActive?: boolean;
            secondaryGraceUntil?: string | null;
          };
        }
      | undefined
  );

  const blockedDecisions = Number(
    ((input.telemetry as any)?.byDecision?.blocked as number | undefined) ?? 0
  );
  const totalDecisions = Number((input.telemetry as any)?.totalDecisions ?? 0);
  if (totalDecisions > 0) {
    const blockedRatio = blockedDecisions / totalDecisions;
    if (blockedRatio >= 0.6) {
      if (typeof input.emitAdversaryEvent === "function") {
        input.emitAdversaryEvent({
          eventType: "suspicious_traversal",
          detail: {
            source: "forgeControlPlane",
            blockedDecisions,
            totalDecisions,
            blockedRatio
          },
          timestamp: new Date().toISOString()
        });
      }

      // EPAAS BEGIN — same anomaly threshold as above: high governance block ratio
      const evt: EpaasAdversaryEvent = {
        eventId: randomUUID(),
        eventType: "suspicious_traversal",
        riskBandAtEvent: "high",
        detail: {
          source: "forgeControlPlane",
          blockedDecisions,
          totalDecisions,
          blockedRatio
        },
        timestamp: new Date()
      };
      adversaryTelemetryService.ingest(evt);
      // EPAAS END
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    mode: input.mode,
    lockdown: input.lockdown === true,
    policy: input.policy,
    telemetry: input.telemetry,
    approvalTokens: input.approvalTokens ?? {},
    intents: input.intents ?? {},
    alerts,
    recommendations: buildControlPlaneRecommendations(input.mode, input.policy, alerts),
    recentGovernanceAudit: governanceAudit
  };
}
