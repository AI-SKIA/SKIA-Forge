import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildMentionContext, parseMentions, rankChunks, resolveMentionPath, type MentionIo } from "./ideMentions.js";

function memoryIo(files: Record<string, string>): MentionIo {
  return {
    readFile: async (p) => {
      if (!(p in files)) throw new Error("ENOENT");
      return files[p];
    },
    listFiles: async (dir) => Object.keys(files).filter((p) => p.startsWith(`${dir}/`))
  };
}

test("parseMentions extracts quoted, bare and codebase mentions and strips them from the query", () => {
  const { mentions, query } = parseMentions('Explain @file:src/a.ts and @folder:"my dir/lib", then @codebase where is auth handled?');
  assert.deepEqual(mentions, [
    { kind: "file", target: "src/a.ts" },
    { kind: "folder", target: "my dir/lib" },
    { kind: "codebase" }
  ]);
  assert.equal(query, "Explain and , then where is auth handled?");
  assert.deepEqual(parseMentions("mail me at dev@file:x.ts").mentions, []);
});

test("resolveMentionPath keeps paths inside the workspace", () => {
  assert.equal(resolveMentionPath("C:\\proj", "src\\a.ts"), "C:/proj/src/a.ts");
  assert.equal(resolveMentionPath("/home/u/proj", "./lib/../src/b.ts"), "/home/u/proj/src/b.ts");
  assert.equal(resolveMentionPath("/home/u/proj", "/home/u/proj/x.ts"), "/home/u/proj/x.ts");
  assert.equal(resolveMentionPath("/home/u/proj", "../secret.txt"), null);
  assert.equal(resolveMentionPath("/home/u/proj", "/etc/passwd"), null);
  assert.equal(resolveMentionPath("/home/u/proj", "/home/u/project2/x"), null);
  assert.equal(resolveMentionPath("", "a.ts"), null);
});

test("rankChunks orders matching windows by term density and path hits", () => {
  const ranked = rankChunks(
    [
      { path: "src/billing.ts", text: "export function charge() {}" },
      { path: "src/auth/session.ts", text: "export function verifySession(token) { return auth(token); }" },
      { path: "README.md", text: "nothing relevant here" }
    ],
    "where is the session auth verified"
  );
  assert.equal(ranked[0].path, "src/auth/session.ts");
  assert.ok(ranked.every((c) => c.path !== "README.md" && c.path !== "src/billing.ts"));
});

test("buildMentionContext inlines files, folders and codebase matches, and refuses outside paths", async () => {
  const io = memoryIo({
    "/w/src/a.ts": "const A = 1;",
    "/w/lib/x.ts": "export const x = 'x';",
    "/w/lib/y.ts": "export const y = 'y';",
    "/w/src/token.ts": "export function refreshToken() { /* rotate token */ }"
  });
  const { block } = await buildMentionContext(
    "@file:src/a.ts @folder:lib @file:../escape.ts @codebase how does refreshToken rotate the token",
    "/w",
    io
  );
  assert.match(block, /^### MENTIONED_CONTEXT/);
  assert.match(block, /### FILE: src\/a\.ts\n```\nconst A = 1;/);
  assert.match(block, /### FILE: lib\/x\.ts/);
  assert.match(block, /### FILE: lib\/y\.ts/);
  assert.match(block, /### CODEBASE MATCH: src\/token\.ts lines 1-1/);
  assert.match(block, /@file:\.\.\/escape\.ts is outside the open workspace/);
  assert.match(block, /### END_MENTIONED_CONTEXT/);

  assert.equal((await buildMentionContext("no mentions here", "/w", io)).block, "");
});

test("the IDE chat envelope resolves mentions before sending", () => {
  const src = readFileSync(path.join(process.cwd(), "skia-ide", "src", "renderer", "skia", "skiaIdeBrainContext.ts"), "utf8");
  assert.match(src, /buildMentionContext\(/);
  assert.match(src, /mentionBlock \+\s*\n\s*snapshotBlock/);
});
