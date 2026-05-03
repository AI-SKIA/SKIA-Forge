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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers.authorization?.trim();
  if (!raw?.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = raw.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
      id?: string | number;
      role?: string;
      sub?: string;
    };
    const id = decoded.id ?? decoded.sub ?? "";
    const role = typeof decoded.role === "string" ? decoded.role : "";
    (req as RequestWithUser).user = { id, role };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
