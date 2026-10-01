import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "./requireAuth.js";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * True only for a direct socket connection from this machine. Uses the socket address,
 * not req.ip, so X-Forwarded-For cannot spoof it; any forwarded request is treated as remote.
 */
export function isLoopbackRequest(req: Request): boolean {
  if (req.headers["x-forwarded-for"] || req.headers.forwarded) return false;
  const addr = req.socket?.remoteAddress ?? "";
  return LOOPBACK_ADDRESSES.has(addr);
}

/** Local-dev routes: open to curl on the same machine, Bearer JWT for everyone else. */
export function loopbackOrAuth(req: Request, res: Response, next: NextFunction): void {
  if (isLoopbackRequest(req)) {
    next();
    return;
  }
  requireAuth(req, res, next);
}
