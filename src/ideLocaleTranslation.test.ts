import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "skia-ide", "src", "renderer", "i18n", "locales");

const BRAND_KEYS = new Set(["nav.forge", "chat.brand"]);
/** Same word in the target language, not leftover English. */
const COGNATES: Record<string, string[]> = {
  fr: ["nav.agent", "views.agent", "nav.terminal", "settings.application", "settings.version"],
  de: ["nav.agent", "views.agent", "nav.terminal", "settings.editor", "settings.status", "settings.version"],
  es: ["nav.terminal", "settings.editor"],
  pt: ["nav.terminal", "settings.editor", "settings.status"]
};

function flatten(o: Record<string, unknown>, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v as Record<string, unknown>, key, out);
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

const read = (name: string) => flatten(JSON.parse(fs.readFileSync(path.join(localesDir, name), "utf8")));

test("IDE locale files carry no leftover English and keep every placeholder", () => {
  const en = read("en.json");
  const problems: string[] = [];
  for (const file of fs.readdirSync(localesDir).filter((n) => n.endsWith(".json") && n !== "en.json")) {
    const locale = file.replace(/\.json$/, "");
    const values = read(file);
    const allowed = new Set([...BRAND_KEYS, ...(COGNATES[locale] ?? [])]);
    for (const [key, source] of Object.entries(en)) {
      const value = values[key];
      if (value === undefined) {
        problems.push(`${locale}: missing ${key}`);
        continue;
      }
      if (value === source && !allowed.has(key) && /[A-Za-z]{2,}/.test(source)) {
        problems.push(`${locale}: ${key} still English`);
      }
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
      if (placeholders(value) !== placeholders(source)) problems.push(`${locale}: ${key} placeholders differ`);
    }
  }
  assert.deepEqual(problems, []);
});
