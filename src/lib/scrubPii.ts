import { createHash } from "node:crypto";

export function scrubPii(text: string): string {
  let out = String(text || "");
  out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
  out = out.replace(/\b(?:\+?\d{1,3})?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[REDACTED_PHONE]");
  out = out.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_CARD]");
  out = out.replace(/\b(?:bearer\s+)?(?:sk|pk|rk|api|token|secret)[_-]?[a-z0-9]{12,}\b/gi, "[REDACTED_TOKEN]");
  out = out.replace(/\b(?:session|user)[_-]?id\s*[:=]\s*[a-z0-9\-_]{4,}\b/gi, "[REDACTED_ID]");
  out = out.replace(/\[MEMORY(?::[^\]]+)?\][^\n]*/gi, "[REDACTED_MEMORY_SPAN]");
  out = out.replace(/\[MEMORY_ARCHIVE(?::[^\]]+)?\][^\n]*/gi, "[REDACTED_MEMORY_SPAN]");
  return out;
}

function hashCorrelatable(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      if (key === "userId" || key === "ip" || key === "sessionId") {
        out[key] = value ? `hash:${hashCorrelatable(value)}` : value;
      } else {
        out[key] = scrubPii(value);
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = scrubObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "string"
          ? scrubPii(item)
          : item && typeof item === "object" && !Array.isArray(item)
            ? scrubObject(item as Record<string, unknown>)
            : item
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}
