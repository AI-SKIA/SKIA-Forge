const norm = (s: string) => s.replace(/\\/g, "/").replace(/^\//, "");

/** Minimal glob: `*`, `**` segments; otherwise prefix / equality. */
export function fileMatchesPattern(fileRel: string, pattern: string): boolean {
  const f = norm(fileRel);
  const p = norm(pattern);
  if (p === "*" || p === "**") {
    return true;
  }
  if (!p.includes("*")) {
    return f === p || f.startsWith(p.endsWith("/") ? p : p + "/");
  }
  const parts = p.split("*");
  if (parts.length === 1) {
    return f === p;
  }
  // Convert simple * wildcard to RegExp
  const re = new RegExp(
    `^${parts
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`
  );
  return re.test(f) || f.startsWith(p.split("*")[0] ?? "");
}

export function importMatchesSpec(importPath: string, spec: string): boolean {
  const a = importPath;
  const b = spec;
  if (!b.length) {
    return false;
  }
  if (!b.includes("*") && b !== "*") {
    return a === b || a.includes(b) || a.startsWith(b);
  }
  return new RegExp(`^${b.split("*").map(escapeR).join(".*")}$`).test(a) || a.includes(b.replace(/\*/g, ""));
}

function escapeR(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
