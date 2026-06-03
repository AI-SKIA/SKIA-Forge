import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isLocalBackendMode,
  isLocalFounderOverrideEnabled,
  PRODUCTION_SKIA_BACKEND_URL,
  resolveSkiaBackendUrl,
} from "./localBackend.js";

const ENV_KEYS = [
  "LOCAL_SKIA_BACKEND_URL",
  "NODE_ENV",
  "SKIA_OWNER_EMAIL",
  "LOCAL_FOUNDER_OVERRIDE",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    out[key] = process.env[key];
  }
  return out;
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("localBackend production isolation", () => {
  const initial = snapshotEnv();

  afterEach(() => {
    restoreEnv(initial);
  });

  it("uses production backend when LOCAL_SKIA_BACKEND_URL is unset", () => {
    delete process.env.LOCAL_SKIA_BACKEND_URL;
    assert.equal(isLocalBackendMode(), false);
    assert.equal(resolveSkiaBackendUrl(), PRODUCTION_SKIA_BACKEND_URL);
  });

  it("activates local mode only when LOCAL_SKIA_BACKEND_URL is set in env", () => {
    process.env.LOCAL_SKIA_BACKEND_URL = "http://localhost:3000";
    assert.equal(isLocalBackendMode(), true);
    assert.equal(resolveSkiaBackendUrl(), "http://localhost:3000");
  });

  it("ignores LOCAL_SKIA_BACKEND_URL in production NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    process.env.LOCAL_SKIA_BACKEND_URL = "http://localhost:3000";
    assert.equal(isLocalBackendMode(), false);
    assert.equal(resolveSkiaBackendUrl(), PRODUCTION_SKIA_BACKEND_URL);
  });

  it("does not enable founder override without local backend mode", () => {
    delete process.env.LOCAL_SKIA_BACKEND_URL;
    process.env.LOCAL_FOUNDER_OVERRIDE = "true";
    assert.equal(isLocalFounderOverrideEnabled(), false);
  });
});
