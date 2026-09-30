import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  embedBootstrapMaxFiles,
  isEmbedBootstrapAfterIndexEnabled,
  pathsForEmbedBootstrap
} from "./embedBootstrapAfterIndex.js";

describe("embedBootstrapAfterIndex", () => {
  it("defaults OFF even when vector provisioned", () => {
    assert.equal(
      isEmbedBootstrapAfterIndexEnabled({
        SKIA_EMBEDDING_VECTOR_PROVISIONED: "true"
      }),
      false
    );
    assert.deepEqual(
      pathsForEmbedBootstrap([{ path: "a.ts" }, { path: "b.ts" }], {
        SKIA_EMBEDDING_VECTOR_PROVISIONED: "true"
      }),
      []
    );
  });

  it("stays OFF when bootstrap true but provisioned unset", () => {
    assert.equal(
      isEmbedBootstrapAfterIndexEnabled({
        EMBED_BOOTSTRAP_AFTER_INDEX: "true"
      }),
      false
    );
  });

  it("enables only when both flags are true", () => {
    const env = {
      EMBED_BOOTSTRAP_AFTER_INDEX: "true",
      SKIA_EMBEDDING_VECTOR_PROVISIONED: "true",
      EMBED_BOOTSTRAP_MAX_FILES: "2"
    };
    assert.equal(isEmbedBootstrapAfterIndexEnabled(env), true);
    assert.equal(embedBootstrapMaxFiles(env), 2);
    assert.deepEqual(
      pathsForEmbedBootstrap([{ path: "a.ts" }, { path: "b.ts" }, { path: "c.ts" }], env),
      ["a.ts", "b.ts"]
    );
  });
});
