import { getSkiaOwnerEmail } from "./skiaConfig";

/**
 * Keep in sync with Skia-FULL `src/utils/forgePlanAccess.ts` (plan-gated Forge IDE; not credits).
 */

const FORGE_PAID_PLANS = new Set(["freelancer", "team", "company"]);
const FORGE_ELIGIBLE_STATUSES = new Set(["active", "trialing", "past_due"]);

const PLAN_ALIASES: Record<string, string> = {
    pro: "freelancer",
    pro_plus: "freelancer",
    individual: "freelancer",
    freelancer: "freelancer",
    teams: "team",
    team: "team",
    business: "company",
    company: "company",
    enterprise: "company",
};

export const FORGE_PLAN_REQUIRED_MESSAGE =
    "SKIA Forge IDE requires a subscription plan (Pro, Team, Business, or Enterprise). Credits and pay-as-you-go top-ups do not include Forge access.";

export type ForgeAccessUser = {
    email?: string;
    enterprisePlan?: boolean;
    subscriptionPlan?: string | null;
    plan?: string | null;
    subscriptionStatus?: string | null;
};

function normalizePlanId(user: ForgeAccessUser): string | null {
    const raw = (user.subscriptionPlan ?? user.plan ?? "").trim().toLowerCase();
    if (!raw || raw === "free") return null;
    if (raw in PLAN_ALIASES) return PLAN_ALIASES[raw];
    if (FORGE_PAID_PLANS.has(raw)) return raw;
    return null;
}

export function userHasForgePlanAccess(user: ForgeAccessUser | null | undefined): boolean {
    if (!user) return false;

    const founderEmail = getSkiaOwnerEmail().trim().toLowerCase();
    if (founderEmail && user.email?.trim().toLowerCase() === founderEmail) return true;

    if (user.enterprisePlan === true) return true;

    const planId = normalizePlanId(user);
    if (!planId) return false;

    const status = (user.subscriptionStatus ?? "").trim().toLowerCase();
    return FORGE_ELIGIBLE_STATUSES.has(status);
}
