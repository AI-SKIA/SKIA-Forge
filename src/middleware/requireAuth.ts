import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET_RAW = process.env.JWT_SECRET?.trim();
if (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 32) {
  throw new Error("JWT_SECRET missing or too short");
}
/** Narrowed secret for jwt.verify (validated above). */
const JWT_SECRET: string = JWT_SECRET_RAW;

export interface RequestWithUser extends Request {
  user: { id: string | number; role: string };
}

/** Verifies a login JWT; returns the user or null. Shared by HTTP routes and WebSockets. */
export function verifyBearerToken(token: string | undefined): RequestWithUser["user"] | null {
  const t = token?.trim();
  if (!t) return null;
  try {
    const decoded = jwt.verify(t, JWT_SECRET) as jwt.JwtPayload & {
      id?: string | number;
      role?: string;
      sub?: string;
    };
    const id = decoded.id ?? decoded.sub ?? "";
    const role = typeof decoded.role === "string" ? decoded.role : "";
    return { id, role };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers.authorization?.trim();
  if (!raw?.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = verifyBearerToken(raw.slice(7));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as RequestWithUser).user = user;
  next();
}
