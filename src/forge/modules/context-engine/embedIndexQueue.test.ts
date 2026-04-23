import assert from "node:assert/strict";
import test from "node:test";
import { EmbedIndexQueue, EmbedIndexQueueBackpressureError } from "./embedIndexQueue.js";

test("embed index queue: runWaiting is serialized with maxConcurrent 1", async () => {
  const q = new EmbedIndexQueue({ maxConcurrent: 1, maxQueued: 20 });
  const out: string[] = [];
  const p1 = q.runWaiting(async () => {
    out.push("a0");
    await new Promise((r) => setTimeout(r, 5));
    out.push("a1");
    return 1;
  });
  const p2 = q.runWaiting(async () => {
    out.push("b0");
    return 2;
  });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 1);
  assert.equal(r2, 2);
  assert.ok(out.indexOf("a0") < out.indexOf("b0"), "second work starts after first finishes with concurrency 1");
  assert.equal(out[0], "a0");
  assert.equal(out[1], "a1");
  assert.equal(out[2], "b0");
});

test("embed index queue: backpressure when waiting depth reaches max", async () => {
  const q = new EmbedIndexQueue({ maxConcurrent: 1, maxQueued: 2 });
  q.enqueueAsync(
    () =>
      new Promise(() => {
        /* first job never completes: holds the single worker */
        void 0;
      })
  );
  await new Promise((r) => setImmediate(r));
  q.enqueueAsync(() => Promise.resolve(1));
  q.enqueueAsync(() => Promise.resolve(2));
  assert.throws(
    () => {
      q.enqueueAsync(() => Promise.resolve(3));
    },
    (e: unknown) => e instanceof EmbedIndexQueueBackpressureError
  );
});

test("embed index queue: async job is recorded and succeeds", async () => {
  const q = new EmbedIndexQueue({ maxConcurrent: 1, maxQueued: 10 });
  const id = q.enqueueAsync(async () => ({ n: 42 }));
  const j0 = q.getJob(id);
  assert.ok(j0, "job exists");
  assert.ok(j0?.state === "running" || j0?.state === "queued" || j0?.state === "succeeded", j0?.state);
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 2));
    const j = q.getJob(id);
    if (j?.state === "succeeded") {
      assert.deepEqual((j as { result?: { n: number } }).result, { n: 42 });
      return;
    }
  }
  assert.fail("job did not complete in time");
});
