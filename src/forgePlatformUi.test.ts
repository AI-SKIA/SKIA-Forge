import assert from "node:assert/strict";
import test from "node:test";
import { renderForgePlatformHtml } from "./forgePlatformUi.js";

test("forge platform html includes brand and core web IDE routes", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes("SKIA FORGE IDE"));
    assert.ok(html.includes('src="/sidebar-logo.png"'));
    assert.ok(html.includes('class="brand-logo"'));
    assert.ok(html.includes('height="28"'));
    assert.ok(html.includes("<h1>SKIA Forge</h1>"));
    assert.ok(html.includes("/api/forge/orchestrate"));
    assert.ok(html.includes("/api/forge/module/"));
    assert.ok(html.includes("/api/forge/modules/status"));
    assert.ok(html.includes("/integration/skia-full"));
    assert.ok(html.includes("SKIA CONNECTED"));
    assert.ok(html.includes("/api/forge/mode"));
    assert.ok(html.includes("Download Skia Forge"));
    assert.ok(html.includes("#d4af37"));
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

test("forge platform html does not include back button", () => {
    const html = renderForgePlatformHtml();
    assert.ok(!html.includes("back-btn"));
    assert.ok(!html.includes("history.back()"));
    assert.ok(!html.includes("← Back"));
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
    assert.ok(html.includes("moduleDescriptions"));
    assert.ok(html.includes("Lifecycle Orchestrate"));
    assert.ok(html.includes("autonomous agent task"));
    assert.ok(html.includes("software delivery lifecycle"));
    assert.ok(html.includes("production-grade operations"));
});