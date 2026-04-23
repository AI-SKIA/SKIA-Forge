import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createEmbedIncrementalOnSaveHandler } from "./embedIncrementalOnSave.js";
import type { EmbedIndexQueue } from "./embedIndexQueue.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";

const dummySkia = {} as SkiaFullAdapter;

test("onFileUnlink enqueues store clear (drops rows for that path)", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-embed-inc-"));
  await fs.mkdir(path.join(root, ".skia"), { recursive: true });
  const storeData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    rows: [
      {
        id: "r1",
        filePath: "gone.ts",
        language: "typescript",
        kind: "function",
        name: "a",
        startLine: 1,
        endLine: 1,
        contentPreview: "x",
        mtimeIso: "2020-01-01T00:00:00.000Z",
        dimensions: 2,
        vector: [1, 0],
        embeddedAt: "2020-01-01T00:00:00.000Z"
      }
    ]
  };
  await fs.writeFile(
    path.join(root, ".skia", "embeddings-v1.json"),
    JSON.stringify(storeData, null, 2),
    "utf8"
  );
  const pending: Promise<unknown>[] = [];
  const queue: Pick<EmbedIndexQueue, "enqueueAsync"> = {
    enqueueAsync(fn) {
      pending.push(fn());
      return "id";
    }
  };
  const env = { ...process.env, EMBED_VECTOR_STORE: "file" } as NodeJS.ProcessEnv;
  const h = createEmbedIncrementalOnSaveHandler({
    projectRoot: root,
    env,
    skia: dummySkia,
    queue: queue as EmbedIndexQueue,
    isPathIgnored: () => false
  });
  h.onFileUnlink("gone.ts");
  await Promise.all(pending);
  const raw = await fs.readFile(path.join(root, ".skia", "embeddings-v1.json"), "utf8");
  const parsed = JSON.parse(raw) as { rows: { filePath: string }[] };
  assert.equal(parsed.rows.length, 0);
});

test("onFileChange when path is ignored clears embeddings", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-embed-ign-"));
  await fs.mkdir(path.join(root, ".skia"), { recursive: true });
  const storeData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    rows: [
      {
        id: "r1",
        filePath: "ign.ts",
        language: "typescript",
        kind: "function",
        name: "a",
        startLine: 1,
        endLine: 1,
        contentPreview: "x",
        mtimeIso: "2020-01-01T00:00:00.000Z",
        dimensions: 2,
        vector: [1, 0],
        embeddedAt: "2020-01-01T00:00:00.000Z"
      }
    ]
  };
  await fs.writeFile(
    path.join(root, ".skia", "embeddings-v1.json"),
    JSON.stringify(storeData, null, 2),
    "utf8"
  );
  const pending: Promise<unknown>[] = [];
  const queue: Pick<EmbedIndexQueue, "enqueueAsync"> = {
    enqueueAsync(fn) {
      pending.push(fn());
      return "id";
    }
  };
  const h = createEmbedIncrementalOnSaveHandler({
    projectRoot: root,
    env: { ...process.env, EMBED_VECTOR_STORE: "file" } as NodeJS.ProcessEnv,
    skia: dummySkia,
    queue: queue as EmbedIndexQueue,
    isPathIgnored: () => true
  });
  h.onFileChange("ign.ts");
  await Promise.all(pending);
  const raw = await fs.readFile(path.join(root, ".skia", "embeddings-v1.json"), "utf8");
  const parsed = JSON.parse(raw) as { rows: { filePath: string }[] };
  assert.equal(parsed.rows.length, 0);
});
