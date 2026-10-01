import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = path.join(root, "skia-ide/src/renderer/i18n/locales");

const GENERIC_CHAT_COPY = [
  "Describe a task for SKIA",
  "Ask SKIA anything",
  "Fragen Sie SKIA etwas",
  "Pregúntale a SKIA cualquier cosa",
  "Demandez n'importe quoi à SKIA",
  "Pergunte qualquer coisa ao SKIA",
  "SKIA'e herhangi bir şey sorun",
  "Спросите SKIA что угодно",
  "SKIAに何でも聞いてください",
  "SKIA에게 무엇이든 물어보세요",
  "询问SKIA任何事情",
  "اسأل SKIA أي شيء",
  "SKIA कुछ भी पूछें",
];

type IdeLocale = { views: { agentPlaceholder: string }; chat: { placeholder: string } };

test("IDE agent and chat placeholders use governed operator copy in every locale", () => {
  const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 12);
  for (const file of files) {
    const locale = JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8")) as IdeLocale;
    for (const value of [locale.views.agentPlaceholder, locale.chat.placeholder]) {
      assert.ok(value.trim().length > 0, `${file} placeholder empty`);
      for (const generic of GENERIC_CHAT_COPY) {
        assert.ok(!value.includes(generic), `${file} still uses generic copy: ${value}`);
      }
    }
  }
  const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8")) as IdeLocale;
  assert.match(en.views.agentPlaceholder, /objective/i);
  assert.match(en.views.agentPlaceholder, /approval/i);
  assert.match(en.chat.placeholder, /workspace/i);
});

test("IDE shell fallbacks and documentation drop the generic chat framing", () => {
  const indexHtml = fs.readFileSync(path.join(root, "skia-ide/src/renderer/index.html"), "utf8");
  const docsHtml = fs.readFileSync(path.join(root, "skia-ide/src/renderer/docs/documentation.html"), "utf8");
  for (const generic of GENERIC_CHAT_COPY) {
    assert.ok(!indexHtml.includes(generic), `index.html still uses: ${generic}`);
    assert.ok(!docsHtml.includes(generic), `documentation.html still uses: ${generic}`);
  }
  assert.ok(!docsHtml.includes("Describe a task and press"));
  assert.ok(docsHtml.includes("no file changes until you approve them"));
});
