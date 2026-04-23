import express from "express";
import { RequestWithContext } from "./requestContext.js";

type Bucket = { windowStart: number; count: number };

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  check(key: string): { allowed: boolean; remaining: number; resetInMs: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { windowStart: now, count: 1 });
      return { allowed: true, remaining: this.maxRequests - 1, resetInMs: this.windowMs };
    }
    if (bucket.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInMs: this.windowMs - (now - bucket.windowStart)
      };
    }
    bucket.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - bucket.count,
      resetInMs: this.windowMs - (now - bucket.windowStart)
    };
  }
}

export function rateLimitMiddleware(limiter: RateLimiter) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const r = req as RequestWithContext;
    const key = `${req.ip}:${req.path}`;
    const verdict = limiter.check(key);
    res.setHeader("x-ratelimit-remaining", String(verdict.remaining));
    res.setHeader("x-ratelimit-reset-ms", String(Math.max(0, verdict.resetInMs)));
    if (!verdict.allowed) {
      return res.status(429).json({
        error: "Rate limit exceeded.",
        requestId: r.requestId ?? "unknown"
      });
    }
    return next();
  };
}

export function enforceTextSize(
  value: string,
  maxChars: number
): { ok: true } | { ok: false; error: string } {
  if (value.length > maxChars) {
    return { ok: false, error: `Payload text exceeds ${maxChars} characters.` };
  }
  return { ok: true };
}
