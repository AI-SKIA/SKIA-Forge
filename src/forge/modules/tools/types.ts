import { z } from "zod";

/**
 * D1-09: tool execution is always scoped to a project root; executor wiring is separate.
 */
export type ToolContext = {
  projectRoot: string;
};

export type ToolSuccess<T = unknown> = {
  success: true;
  data: T;
  /**
   * Opaque handle for mutating tools; passed to `rollback`.
   * Read-only tools omit this.
   */
  rollbackHandle?: unknown;
};

export type ToolFailure = {
  success: false;
  error: string;
  code?: string;
};

export type ToolExecuteResult<T = unknown> = ToolSuccess<T> | ToolFailure;

/**
 * Pluggable tool: validate → execute → (optional) rollback.
 */
export type ForgeTool = {
  name: string;
  description: string;
  /** Exposed for contracts / UIs. */
  inputSchema: z.ZodType<unknown>;
  validate: (raw: unknown) => { ok: true; data: unknown } | { ok: false; error: string };
  execute: (ctx: ToolContext, input: unknown) => Promise<ToolExecuteResult>;
  /**
   * Restore pre-mutation state. No-op for read-only tools; safe to call with undefined.
   */
  rollback: (ctx: ToolContext, rollbackHandle: unknown) => Promise<ToolExecuteResult<undefined>>;
};

export function isToolSuccess(
  r: ToolExecuteResult
): r is ToolSuccess {
  return r.success === true;
}
