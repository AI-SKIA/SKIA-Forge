#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const edits = [
  {
    file: "src/forgePlatformUi.ts",
    bodyFrom: '<body data-forge-i18n-page="forge-platform">',
    bodyTo: '<body class="forge-context-b forge-platform-shell" data-forge-i18n-page="forge-platform">',
  },
  {
    file: "src/forgeSignInUi.ts",
    bodyFrom: "<body>",
    bodyTo: '<body class="forge-context-b forge-sign-in-shell">',
  },
  {
    file: "src/chatUi.ts",
    bodyFrom: "<body>",
    bodyTo: '<body class="forge-context-b forge-chat-shell">',
  },
];

const link = '  <link rel="stylesheet" href="/forge-platform-console.css" />';

for (const { file, bodyFrom, bodyTo } of edits) {
  const full = path.join(root, file);
  let html = fs.readFileSync(full, "utf8");
  html = html.replace(/\n  <style>[\s\S]*?\n  <\/style>/, `\n${link}`);
  html = html.replace(bodyFrom, bodyTo);
  fs.writeFileSync(full, html);
  console.log("updated", file);
}
