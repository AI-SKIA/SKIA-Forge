import { z } from "zod";

const boundaryRuleSchema = z.object({
  /** Minimatch-like or prefix match on source file path (relative POSIX) */
  pathPattern: z.string().min(1).max(4_000),
  /** If non-empty, an import is allowed only if it matches at least one pattern */
  canImportFrom: z.array(z.string().min(1).max(2_000)).optional(),
  cannotImportFrom: z.array(z.string().min(1).max(2_000)).optional()
});

const architectureSchema = z
  .object({
    structure: z.string().max(16_000).optional(),
    boundaries: z.array(boundaryRuleSchema).optional()
  })
  .optional();

const skiaProfileSchema = z
  .object({
    personality: z.string().max(8_000).optional(),
    identity: z.string().max(8_000).optional()
  })
  .optional();

const brandSchema = z
  .object({
    palette: z
      .object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
        accent: z.string().optional()
      })
      .optional(),
    voice: z.string().max(4_000).optional()
  })
  .optional();

const conventionsSchema = z
  .object({
    naming: z.string().max(2_000).optional(),
    patterns: z.array(z.string().min(1).max(1_000)).optional(),
    anti_patterns: z.array(z.string().min(1).max(1_000)).optional()
  })
  .optional();

const projectSchema = z
  .object({
    name: z.string().max(500).optional(),
    description: z.string().max(8_000).optional(),
    language: z.string().max(200).optional(),
    framework: z.string().max(200).optional(),
    runtime: z.string().max(200).optional()
  })
  .optional();

const agentSchema = z
  .object({
    allowed_commands: z.array(z.string().min(1).max(1_000)).optional(),
    blocked_paths: z.array(z.string().min(1).max(4_000)).optional(),
    /** Tool names (exact) that may bypass file / high-risk approval in executor */
    auto_approve: z.array(z.string().min(1).max(200)).optional()
  })
  .optional();

const governanceSchema = z
  .object({
    default_mode: z.enum(["strict", "adaptive", "autonomous"]).optional(),
    approval_required_modules: z.array(z.string().min(1).max(100)).optional()
  })
  .optional();

/** D1-12: full in-memory .skiarules model (no enforcement in this file). */
export const skiarulesConfigSchema = z.object({
  project: projectSchema,
  conventions: conventionsSchema,
  architecture: architectureSchema,
  skia: skiaProfileSchema,
  agent: agentSchema,
  brand: brandSchema,
  governance: governanceSchema
});

export type SkiarulesConfig = z.infer<typeof skiarulesConfigSchema>;
export type SkiarulesBoundaryRule = z.infer<typeof boundaryRuleSchema>;
export { boundaryRuleSchema };

export type SkiarulesLoadError = {
  ok: false;
  message: string;
  path: string;
  cause?: string;
};
