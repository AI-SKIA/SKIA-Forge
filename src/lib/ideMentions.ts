/**
 * @file / @folder / @codebase mentions for the Forge IDE chat. Resolved against the user's
 * local workspace (the hosted Forge server cannot see it), then prepended to the chat envelope.
 */

export type IdeMention =
  | { kind: "file"; target: string }
  | { kind: "folder"; target: string }
  | { kind: "codebase" };

export type MentionIo = {
  readFile: (absPath: string) => Promise<string>;
  /** Absolute paths of indexable text files under a directory (recursive). */
  listFiles: (absDir: string) => Promise<string[]>;
};

const MENTION_RE = /(^|\s)@(file|folder):(?:"([^"]+)"|(\S+))|(^|\s)@codebase\b/g;

export const MENTION_LIMITS = {
  fileChars: 120_000,
  folderFiles: 40,
  folderChars: 120_000,
  codebaseChunks: 12,
  codebaseChars: 60_000,
  codebaseFiles: 1_500,
  codebaseFileChars: 200_000,
  chunkLines: 40
} as const;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "what", "where", "how", "why", "does", "into",
  "are", "was", "can", "you", "your", "our", "use", "used", "using", "code", "file", "files", "please"
]);

export function parseMentions(text: string): { mentions: IdeMention[]; query: string } {
  const mentions: IdeMention[] = [];
  const query = text
    .replace(MENTION_RE, (_m, lead1, kind, quoted, bare, lead2) => {
      if (kind === "file" || kind === "folder") {
        mentions.push({ kind, target: String(quoted ?? bare).replace(/[),.;]+$/, "") });
        return lead1 ?? " ";
      }
      mentions.push({ kind: "codebase" });
      return lead2 ?? " ";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
  return { mentions, query };
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Workspace-relative or absolute target -> absolute path inside the workspace, or null. */
export function resolveMentionPath(workspaceRoot: string, target: string): string | null {
  const root = normalize(workspaceRoot);
  const t = normalize(target.trim());
  if (!root || !t || /[\0\n\r]/.test(t)) return null;
  const isAbs = /^[a-zA-Z]:\//.test(t) || t.startsWith("/");
  const parts: string[] = [];
  for (const seg of (isAbs ? t : `${root}/${t}`).split("/")) {
    if (seg === "" && parts.length === 0) {
      parts.push("");
      continue;
    }
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length <= 1) return null;
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  const abs = parts.join("/");
  const cmp = (s: string) => (/^[a-zA-Z]:/.test(s) ? s.toLowerCase() : s);
  if (cmp(abs) !== cmp(root) && !cmp(abs).startsWith(cmp(root) + "/")) return null;
  return abs;
}

export function queryTerms(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_$]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(terms)];
}

export type RankedChunk = { path: string; startLine: number; text: string; score: number };

/** Lexical ranking of fixed-size line windows; path hits count double. */
export function rankChunks(files: Array<{ path: string; text: string }>, query: string): RankedChunk[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const out: RankedChunk[] = [];
  for (const f of files) {
    const pathLower = f.path.toLowerCase();
    const pathBonus = terms.reduce((n, t) => n + (pathLower.includes(t) ? 2 : 0), 0);
    const lines = f.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += MENTION_LIMITS.chunkLines) {
      const text = lines.slice(i, i + MENTION_LIMITS.chunkLines).join("\n");
      const lower = text.toLowerCase();
      let score = 0;
      let distinct = 0;
      for (const t of terms) {
        const hits = lower.split(t).length - 1;
        if (hits > 0) {
          distinct += 1;
          score += Math.min(hits, 5);
        }
      }
      if (distinct === 0) continue;
      out.push({ path: f.path, startLine: i + 1, text, score: score * distinct + pathBonus });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.startLine - b.startLine);
}

function fence(label: string, body: string): string {
  return `### ${label}\n\`\`\`\n${body}\n\`\`\`\n`;
}

function relative(root: string, abs: string): string {
  const r = normalize(root);
  return abs.startsWith(r + "/") ? abs.slice(r.length + 1) : abs;
}

/** Builds the MENTIONED_CONTEXT block; empty string when the message has no mentions. */
export async function buildMentionContext(
  text: string,
  workspaceRoot: string,
  io: MentionIo
): Promise<{ block: string; query: string; mentions: IdeMention[] }> {
  const { mentions, query } = parseMentions(text);
  if (!mentions.length) return { block: "", query, mentions };
  const parts: string[] = [];
  const notes: string[] = [];

  for (const m of mentions) {
    if (m.kind === "codebase") continue;
    const abs = resolveMentionPath(workspaceRoot, m.target);
    if (!abs) {
      notes.push(`@${m.kind}:${m.target} is outside the open workspace and was not read.`);
      continue;
    }
    if (m.kind === "file") {
      try {
        let body = await io.readFile(abs);
        if (body.length > MENTION_LIMITS.fileChars) body = `${body.slice(0, MENTION_LIMITS.fileChars)}\n...[file truncated]`;
        parts.push(fence(`FILE: ${relative(workspaceRoot, abs)}`, body));
      } catch {
        notes.push(`@file:${m.target} could not be read.`);
      }
      continue;
    }
    let files: string[];
    try {
      files = (await io.listFiles(abs)).sort();
    } catch {
      notes.push(`@folder:${m.target} could not be listed.`);
      continue;
    }
    let used = 0;
    const listed = files.slice(0, MENTION_LIMITS.folderFiles);
    for (const f of listed) {
      if (used >= MENTION_LIMITS.folderChars) break;
      try {
        let body = await io.readFile(f);
        const room = MENTION_LIMITS.folderChars - used;
        if (body.length > room) body = `${body.slice(0, room)}\n...[folder budget reached]`;
        parts.push(fence(`FILE: ${relative(workspaceRoot, f)}`, body));
        used += body.length;
      } catch {
        // unreadable file: skip
      }
    }
    if (files.length > listed.length) notes.push(`@folder:${m.target}: first ${listed.length} of ${files.length} files included.`);
  }

  if (mentions.some((m) => m.kind === "codebase")) {
    const root = normalize(workspaceRoot);
    const all = root && root !== "browser-workspace" ? await io.listFiles(root).catch(() => [] as string[]) : [];
    const loaded: Array<{ path: string; text: string }> = [];
    for (const f of all.slice(0, MENTION_LIMITS.codebaseFiles)) {
      try {
        const text = await io.readFile(f);
        if (text.length <= MENTION_LIMITS.codebaseFileChars) loaded.push({ path: relative(workspaceRoot, f), text });
      } catch {
        // unreadable file: skip
      }
    }
    if (all.length > MENTION_LIMITS.codebaseFiles) {
      notes.push(`@codebase: searched the first ${MENTION_LIMITS.codebaseFiles} of ${all.length} files.`);
    }
    const ranked = rankChunks(loaded, query);
    let used = 0;
    let taken = 0;
    for (const c of ranked) {
      if (taken >= MENTION_LIMITS.codebaseChunks || used + c.text.length > MENTION_LIMITS.codebaseChars) break;
      const end = c.startLine + c.text.split("\n").length - 1;
      parts.push(fence(`CODEBASE MATCH: ${c.path} lines ${c.startLine}-${end}`, c.text));
      used += c.text.length;
      taken += 1;
    }
    if (!taken) notes.push(all.length ? "@codebase: no file matched the question's terms." : "@codebase: no workspace folder is open.");
  }

  const block = [
    "### MENTIONED_CONTEXT",
    "The user explicitly referenced these files with @file / @folder / @codebase. Treat them as the primary context for this turn.",
    "",
    ...parts,
    ...(notes.length ? ["notes:", ...notes.map((n) => `- ${n}`), ""] : []),
    "### END_MENTIONED_CONTEXT",
    ""
  ].join("\n");
  return { block, query, mentions };
}
