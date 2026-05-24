import assert from "node:assert/strict";
import test from "node:test";
import { renderForgeSignInHtml } from "./forgeSignInUi.js";

test("forge sign-in page posts to forge auth with forge-web client", () => {
  const html = renderForgeSignInHtml();
  assert.ok(html.includes("/api/auth/login"));
  assert.ok(html.includes('x-skia-client": "forge-web"'));
  assert.ok(html.includes("skia_session_token"));
  assert.ok(html.includes("returnTo"));
});
