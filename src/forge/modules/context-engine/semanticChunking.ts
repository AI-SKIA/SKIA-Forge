import { sha256, estimateTokenCount } from "../../../utils.js";
import type { StructuralKind, StructuralSymbol } from "./structuralTypes.js";

const MAX_CHUNK_LINES = 300;
const OVERLAP_TOKEN_BUDGET = 50;
const MAX_OVERLAP_LINES = 12;
/** §4.1 D1-02: target chunk band; this stage enforces the high bound (soft min for tiny symbols). */
export const MAX_SEMANTIC_TOKENS = 500;

type RawRow = {
  id: string;
  filePath: string;
  name: string;
  kind: StructuralKind;
  parentName?: string;
  startLine: number;
  endLine: number;
  _content: string;
};

export type SemanticCodeChunk = {
  id: string;
  filePath: string;
  name: string;
  kind: StructuralKind;
  parentName?: string;
  startLine: number;
  endLine: number;
  content: string;
  tokenEstimate: number;
  overlapFromPreviousChars?: number;
};

function symKey(s: StructuralSymbol): string {
  return `${s.kind}:${s.name}:${s.startLine}:${s.endLine}`;
}

function pushLineRange(
  lines: string[],
  filePath: string,
  name: string,
  kind: StructuralKind,
  parent: string | undefined,
  startLine: number,
  endLine: number,
  raw: RawRow[]
): void {
  if (startLine < 1 || endLine < startLine) return;
  const startIdx = startLine - 1;
  let endIdx = endLine - 1;
  if (endIdx - startIdx + 1 > MAX_CHUNK_LINES) {
    endIdx = startIdx + MAX_CHUNK_LINES - 1;
  }
  const _content = lines.slice(startIdx, endIdx + 1).join("\n");
  if (!_content.trim()) return;
  const endL = startIdx + (endIdx - startIdx) + 1;
  const id = sha256(`${filePath}:${startLine}:${endL}:${name}:${kind}`);
  raw.push({ id, filePath, name, kind, parentName: parent, startLine, endLine: endL, _content });
}

/**
 * D1-02: chunk by D1-01 — batched import/export, class → header + methods, 50-token overlap.
 */
export function buildSemanticChunksFromStructure(
  filePath: string,
  content: string,
  symbols: StructuralSymbol[]
): SemanticCodeChunk[] {
  const lines = content.split(/\r?\n/);
  if (symbols.length === 0) {
    return [];
  }
  const raw: RawRow[] = [];

  const imports = symbols.filter((s) => s.kind === "import");
  if (imports.length) {
    const startLine = Math.min(...imports.map((s) => s.startLine));
    const endLine = Math.max(...imports.map((s) => s.endLine));
    pushLineRange(lines, filePath, "imports", "import", undefined, startLine, endLine, raw);
  }

  const exports_ = symbols.filter((s) => s.kind === "export");
  if (exports_.length) {
    const startLine = Math.min(...exports_.map((s) => s.startLine));
    const endLine = Math.max(...exports_.map((s) => s.endLine));
    pushLineRange(lines, filePath, "exports", "export", undefined, startLine, endLine, raw);
  }

  const rest = symbols.filter((s) => s.kind !== "import" && s.kind !== "export");
  const consumed = new Set<string>();
  const classSyms = rest.filter((s) => s.kind === "class");

  for (const cls of classSyms) {
    if (consumed.has(symKey(cls))) continue;
    const childMethods = rest.filter(
      (s) =>
        s.kind === "method" &&
        s.parentName === cls.name &&
        s.startLine >= cls.startLine &&
        s.endLine <= cls.endLine
    );
    childMethods.sort((a, b) => a.startLine - b.startLine);
    if (childMethods.length > 0) {
      const firstM = childMethods[0]!.startLine;
      if (firstM > cls.startLine) {
        pushLineRange(lines, filePath, cls.name, "class", cls.parentName, cls.startLine, firstM - 1, raw);
      }
      for (const m of childMethods) {
        if (!consumed.has(symKey(m))) {
          pushLineRange(lines, filePath, m.name, "method", m.parentName, m.startLine, m.endLine, raw);
          consumed.add(symKey(m));
        }
      }
    } else {
      pushLineRange(lines, filePath, cls.name, "class", cls.parentName, cls.startLine, cls.endLine, raw);
    }
    consumed.add(symKey(cls));
  }

  for (const s of rest) {
    if (consumed.has(symKey(s))) continue;
    pushLineRange(lines, filePath, s.name, s.kind, s.parentName, s.startLine, s.endLine, raw);
  }

  raw.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
  const base: SemanticCodeChunk[] = raw.map((r) => ({
    id: r.id,
    filePath: r.filePath,
    name: r.name,
    kind: r.kind,
    parentName: r.parentName,
    startLine: r.startLine,
    endLine: r.endLine,
    content: r._content,
    tokenEstimate: estimateTokenCount(r._content)
  }));
  const splitToBudget = base.flatMap((b) => splitOversizedSemanticChunk(b));
  splitToBudget.sort(
    (a, b) => a.startLine - b.startLine || a.endLine - b.endLine || a.id.localeCompare(b.id)
  );
  return applyFiftyTokenOverlap(splitToBudget);
}

type SplitPiece = {
  text: string;
  startLine: number;
  endLine: number;
  /** How to attach to the previous piece when joining (first piece ignores). */
  glue: "none" | "newline" | "concat";
};

function splitStringByTokenBudget(s: string, maxTokens: number): string[] {
  if (s.length === 0) {
    return [s];
  }
  if (estimateTokenCount(s) <= maxTokens) {
    return [s];
  }
  const out: string[] = [];
  let i = 0;
  const maxChars = maxTokens * 4;
  while (i < s.length) {
    let lo = i + 1;
    let hi = s.length + 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (estimateTokenCount(s.slice(i, mid)) <= maxTokens) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    let j = lo - 1;
    if (j <= i) {
      j = Math.min(i + maxChars, s.length);
    }
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}

function buildSplitPieces(content: string, cStartLine: number): SplitPiece[] {
  const lines = content.split("\n");
  const pieces: SplitPiece[] = [];
  let first = true;
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li]!;
    const a = cStartLine + li;
    const subs =
      estimateTokenCount(L) <= MAX_SEMANTIC_TOKENS
        ? [L]
        : splitStringByTokenBudget(L, MAX_SEMANTIC_TOKENS);
    for (let j = 0; j < subs.length; j++) {
      let glue: "none" | "newline" | "concat" = "none";
      if (!first) {
        glue = j > 0 ? "concat" : "newline";
      }
      first = false;
      pieces.push({ text: subs[j]!, startLine: a, endLine: a, glue });
    }
  }
  return pieces;
}

function joinSplitPieces(p: SplitPiece[]): string {
  if (p.length === 0) return "";
  let s = p[0]!.text;
  for (let k = 1; k < p.length; k++) {
    if (p[k]!.glue === "concat") {
      s += p[k]!.text;
    } else {
      s += "\n" + p[k]!.text;
    }
  }
  return s;
}

function splitOversizedSemanticChunk(c: SemanticCodeChunk): SemanticCodeChunk[] {
  if (c.tokenEstimate <= MAX_SEMANTIC_TOKENS) {
    return [c];
  }
  const pieces = buildSplitPieces(c.content, c.startLine);
  if (pieces.length === 0) {
    return [c];
  }
  const groups: SplitPiece[][] = [];
  let group: SplitPiece[] = [pieces[0]!];
  for (let i = 1; i < pieces.length; i++) {
    const trial = [...group, pieces[i]!];
    const merged = joinSplitPieces(trial);
    if (estimateTokenCount(merged) > MAX_SEMANTIC_TOKENS) {
      groups.push(group);
      group = [pieces[i]!];
    } else {
      group = trial;
    }
  }
  if (group.length) {
    groups.push(group);
  }
  const rawParts = groups.map((g) => {
    const text = joinSplitPieces(g);
    const sL = g[0]!.startLine;
    const eL = g[g.length - 1]!.endLine;
    return {
      id: sha256(`${c.filePath}:${sL}:${eL}:${c.name}:${c.kind}:${g.length}:${text.length}`),
      filePath: c.filePath,
      name: c.name,
      kind: c.kind,
      parentName: c.parentName,
      startLine: sL,
      endLine: eL,
      content: text,
      tokenEstimate: estimateTokenCount(text)
    } as SemanticCodeChunk;
  });
  if (rawParts.length <= 1) {
    return rawParts;
  }
  return rawParts.map((p, idx) => ({
    ...p,
    name: `${c.name} (${idx + 1}/${rawParts.length})`
  }));
}

function applyFiftyTokenOverlap(sorted: SemanticCodeChunk[]): SemanticCodeChunk[] {
  if (sorted.length < 2) {
    return sorted;
  }
  const out: SemanticCodeChunk[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = sorted[i]!;
    const overlap = takeOverlapTailFromText(prev.content, OVERLAP_TOKEN_BUDGET, MAX_OVERLAP_LINES);
    if (!overlap) {
      out.push({ ...cur });
      continue;
    }
    const newContent = `${overlap}\n${cur.content}`;
    const oChars = overlap.length + 1;
    out.push({
      ...cur,
      content: newContent,
      tokenEstimate: estimateTokenCount(newContent),
      overlapFromPreviousChars: oChars
    });
  }
  return out;
}

function takeSuffixCappedToTokenBudget(s: string, maxTokens: number): string {
  if (estimateTokenCount(s) <= maxTokens) {
    return s;
  }
  let lo = 1;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (estimateTokenCount(s.slice(s.length - mid)) <= maxTokens) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return s.slice(s.length - lo);
}

/**
 * At most `tokenBudget` approximated tokens, using up to `maxLines` logical lines
 * (then a character tail) so a single 500+ token line does not become the full overlap.
 */
function takeOverlapTailFromText(text: string, tokenBudget: number, maxLines: number): string {
  const lineArr = text.split("\n");
  if (lineArr.length === 0) {
    return "";
  }
  const taken: string[] = [];
  for (let i = lineArr.length - 1; i >= 0 && taken.length < maxLines; i--) {
    taken.unshift(lineArr[i]!);
    const t = taken.join("\n");
    if (estimateTokenCount(t) >= tokenBudget) {
      return takeSuffixCappedToTokenBudget(t, tokenBudget);
    }
  }
  const t = taken.join("\n");
  if (!t.trim()) {
    return "";
  }
  return takeSuffixCappedToTokenBudget(t, tokenBudget);
}
