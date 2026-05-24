import assert from "node:assert/strict";
import test from "node:test";
import { renderForgePlatformHtml } from "./forgePlatformUi.js";

test("forge platform html includes brand and core web IDE routes", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes('data-i18n="forge-platform.header.brand"'));
    assert.ok(html.includes('src="/sidebar-logo.png"'));
    assert.ok(html.includes('class="brand-logo"'));
    assert.ok(html.includes('height="28"'));
    assert.ok(html.includes('data-i18n="forge-platform.hero.defaultTitle"'));
    assert.ok(html.includes("/api/forge/orchestrate"));
    assert.ok(html.includes("/api/forge/module/"));
    assert.ok(html.includes("/api/forge/modules/status"));
    assert.ok(html.includes("/integration/skia-full"));
    assert.ok(html.includes('fp("header.statusConnected")'));
    assert.ok(html.includes("/api/forge/mode"));
    assert.ok(html.includes("DOWNLOAD SKIA FORGE"));
    assert.ok(html.includes("#d4af37"));
    assert.ok(html.includes('data-forge-i18n-page="forge-platform"'));
    assert.ok(html.includes("/forge-page-locale.js"));
});

test("forge platform html includes session bootstrap and bearer auth helpers", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes("bootstrapForgeSession"));
    assert.ok(html.includes("authHeaders"));
    assert.ok(html.includes('fetch("/api/auth/session"'));
    assert.ok(html.includes("credentials: \"include\""));
    assert.ok(html.includes("Authorization"));
    assert.ok(html.includes("_forgeToken"));
    assert.ok(html.includes("DOMContentLoaded"));
    assert.ok(html.includes("SKIA INTEGRATION UNAVAILABLE — not authenticated"));
    assert.ok(!html.includes("Authorization: Bearer hardcoded"));
});

test("forge platform html includes Forge Home under lifecycle module", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes('id="forgeHomeLink"'));
    assert.ok(html.includes("mod-btn-home"));
    assert.ok(html.includes('data-i18n="forge-platform.sidebar.forgeHome"'));
    assert.ok(html.includes("wireForgeHomeLink"));
    assert.ok(html.includes("forgeHomeHref"));
});

test("forge platform login uses skia session handoff with returnTo", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes("buildSkiaLoginUrl"));
    assert.ok(html.includes("skia.ca/api/auth/forge-bridge?returnTo="));
    assert.ok(html.includes("redirectToSkiaHandoff"));
    assert.ok(html.includes("isArrivingFromSkiaSite"));
    assert.ok(html.includes("x-skia-client"));
    assert.ok(html.includes("forge-web"));
    assert.ok(html.includes("skia_session_token"));
    assert.ok(!html.includes('href="https://skia.ca/login" target="_blank"'));
});

test("forge platform html includes all module buttons", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes('data-module="agent"'));
    assert.ok(html.includes('data-module="context"'));
    assert.ok(html.includes('data-module="sdlc"'));
    assert.ok(html.includes('data-module="production"'));
    assert.ok(html.includes('data-module="healing"'));
    assert.ok(html.includes('data-module="architecture"'));
    assert.ok(html.includes('data-module="orchestrate"'));
});

test("forge platform html includes module descriptions", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes("buildModuleDescriptions"));
    assert.ok(html.includes('data-i18n="forge-platform.modules.orchestrate.label"'));
    assert.ok(html.includes('"modules." + key + ".desc"'));
});