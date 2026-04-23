import { SkiaBrainProbeRow } from "./skiaFullAdapter.js";

export type ProbeCategory = "ok" | "auth" | "contract" | "unreachable" | "unknown";

export function classifyProbeRow(row: SkiaBrainProbeRow): ProbeCategory {
  if (!row.reachable || row.status === 0) return "unreachable";
  if (row.ok) return "ok";
  if (row.status === 401 || row.status === 403) return "auth";
  if (row.status === 404 || row.status === 405 || row.status === 422) return "contract";
  if (row.status >= 400 && row.status < 500) return "contract";
  if (row.status >= 500) return "unknown";
  return "unknown";
}

export function buildProbeReport(rows: SkiaBrainProbeRow[]) {
  const items = rows.map((row) => {
    const category = classifyProbeRow(row);
    const hint =
      category === "auth"
        ? "Check bearer/api-key/cookie forwarding and upstream auth scopes."
        : category === "contract"
          ? "Verify endpoint path, method, and payload schema against SKIA-FULL runtime."
          : category === "unreachable"
            ? "Check network reachability, DNS, and SKIA_FULL_API_URL."
            : category === "ok"
              ? "Healthy."
              : "Inspect upstream logs and probe detail snippet.";
    return {
      ...row,
      category,
      hint
    };
  });
  const summary = {
    total: items.length,
    ok: items.filter((i) => i.category === "ok").length,
    auth: items.filter((i) => i.category === "auth").length,
    contract: items.filter((i) => i.category === "contract").length,
    unreachable: items.filter((i) => i.category === "unreachable").length,
    unknown: items.filter((i) => i.category === "unknown").length
  };
  return { summary, items };
}
