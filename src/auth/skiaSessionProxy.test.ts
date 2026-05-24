import assert from "node:assert/strict";
import type { Request } from "express";
import test from "node:test";

import {
  buildHandoffRedirectUrl,
  buildSkiaLoginRedirect,
  extractSessionTokenFromRequest,
  localePrefixFromPath,
  resolveSafeReturnTo
} from "./skiaSessionProxy.js";

test("resolveSafeReturnTo allows same-origin paths only", () => {
  const req = {
    protocol: "https",
    get(name: string) {
      if (name === "host") return "forge.skia.ca";
      if (name === "x-forwarded-proto") return "https";
      return undefined;
    },
    query: { returnTo: "https://evil.example/phish" }
  } as unknown as Request;

  assert.equal(resolveSafeReturnTo(req), "/forge/platform");
});

test("resolveSafeReturnTo keeps localized forge paths", () => {
  const req = {
    protocol: "https",
    get(name: string) {
      if (name === "host") return "forge.skia.ca";
      return undefined;
    },
    query: { returnTo: "/en/forge/platform" }
  } as unknown as Request;

  assert.equal(resolveSafeReturnTo(req), "/en/forge/platform");
});

test("buildHandoffRedirectUrl appends token hash", () => {
  const req = {
    protocol: "https",
    get(name: string) {
      if (name === "host") return "forge.skia.ca";
      return undefined;
    }
  } as unknown as Request;

  const url = buildHandoffRedirectUrl(req, "/en/forge/platform", "abc.def");
  assert.ok(url.startsWith("https://forge.skia.ca/en/forge/platform#token="));
  assert.ok(url.includes(encodeURIComponent("abc.def")));
});

test("localePrefixFromPath reads leading locale segment", () => {
  assert.equal(localePrefixFromPath("/en/forge/platform"), "/en");
  assert.equal(localePrefixFromPath("/forge/platform"), "");
  assert.equal(
    localePrefixFromPath("https://forge.skia.ca/en/forge/platform"),
    "/en"
  );
});

test("extractSessionTokenFromRequest reads token cookie", () => {
  const req = {
    headers: { cookie: "token=abc.jwt; other=1" }
  } as unknown as Request;
  assert.equal(extractSessionTokenFromRequest(req), "abc.jwt");
});

test("buildSkiaLoginRedirect preserves locale from full returnTo URL", () => {
  const req = {
    protocol: "https",
    get(name: string) {
      if (name === "host") return "forge.skia.ca";
      return undefined;
    }
  } as unknown as Request;
  const url = buildSkiaLoginRedirect(
    req,
    "https://forge.skia.ca/en/forge/platform"
  );
  assert.ok(url.startsWith("https://skia.ca/en/login?returnTo="));
});
