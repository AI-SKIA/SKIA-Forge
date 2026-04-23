import crypto from "node:crypto";
import path from "node:path";

const languageByExtension: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".cs": "csharp"
};

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return languageByExtension[ext] ?? "plaintext";
}

export function toPosixPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function estimateTokenCount(content: string): number {
  // Fast approximation used until embedding/tokenizer integration.
  return Math.ceil(content.length / 4);
}

export function cosineLikeScore(query: string, text: string): number {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return 0;
  const textTerms = new Set(tokenize(text));
  const overlap = queryTerms.filter((term) => textTerms.has(term)).length;
  return overlap / queryTerms.length;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length > 1);
}
