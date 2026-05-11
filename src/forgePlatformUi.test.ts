import assert from "node:assert/strict";
import test from "node:test";
import { renderForgePlatformHtml } from "./forgePlatformUi.js";

test("forge platform html includes brand and core web IDE routes", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes("SKIA FORGE IDE"));
    assert.ok(html.includes("<h1>SKIA Forge</h1>"));
    assert.ok(html.includes("/api/forge/orchestrate"));
    assert.ok(html.includes("/api/forge/module/"));
    assert.ok(html.includes("/api/forge/modules/status"));
    assert.ok(html.includes("/integration/skia-full"));
    assert.ok(html.includes("SKIA connected"));
    assert.ok(html.includes("/api/forge/mode"));
    assert.ok(html.includes("Download App"));
    assert.ok(html.includes("#d4af37"));
});

test("forge platform html includes back button", () => {
    const html = renderForgePlatformHtml();
    assert.ok(html.includes("back-btn"));
    assert.ok(html.includes("history.back()"));
    assert.ok(html.includes("← Back"));
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