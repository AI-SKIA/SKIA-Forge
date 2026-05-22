/**
 * Build skia-ide locale JSON from Skia-FULL frontend/locales (sibling repo).
 * Run from SKIA-Forge: node scripts/sync-forge-locales.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORGE_ROOT = path.resolve(__dirname, "..");
const FULL_LOCALES = path.resolve(FORGE_ROOT, "..", "Skia-FULL", "frontend", "locales");
const OUT_DIR = path.join(FORGE_ROOT, "skia-ide", "src", "renderer", "i18n", "locales");

const LOCALES = ["fr", "en", "zh", "es", "ar", "pt", "de", "ja", "ko", "hi", "tr", "ru"];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function voiceLabel(lang) {
  try {
    const dn = new Intl.DisplayNames([lang.split("-")[0] || "en"], { type: "language" });
    const region = lang.split("-")[1];
    const langName = dn.of(lang.split("-")[0] || "en") || lang;
    if (!region) return langName;
    const rn = new Intl.DisplayNames(["en"], { type: "region" });
    const regionName = rn.of(region) || region;
    return `${langName} (${regionName})`;
  } catch {
    return lang;
  }
}

function buildFromFull(loc, enTemplate) {
  const chatPath = path.join(FULL_LOCALES, loc, "chat.json");
  if (!fs.existsSync(chatPath)) {
    console.warn(`skip ${loc}: no chat.json`);
    return null;
  }
  const chat = readJson(chatPath);
  const out = structuredClone(enTemplate);

  out.chat.placeholder = chat.input?.placeholder ?? out.chat.placeholder;
  out.chat.send = chat.input?.send ?? out.chat.send;
  out.chat.nationality = chat.input?.nationality ?? out.chat.nationality;
  out.chat.voiceNationality = chat.input?.voiceNationality ?? out.chat.voiceNationality;
  out.chat.newChat = chat.echo?.newConversationCta ?? out.chat.newChat;
  out.chat.clear = chat.toolbar?.clearHistory ?? out.chat.clear;
  out.chat.download = (chat.message?.download ?? "Download").toUpperCase();
  out.chat.downloadTitle = chat.message?.downloadReplyTitle ?? out.chat.downloadTitle;
  out.chat.initialMessage = chat.initialMessage ?? out.chat.initialMessage;
  out.chat.signInRequired = out.chat.signInRequired;
  out.chat.tagline = out.chat.tagline;

  out.chat.errors.sessionExpired = chat.errors?.sessionExpired ?? out.chat.errors.sessionExpired;
  out.chat.errors.noCredits = chat.errors?.noCredits ?? out.chat.errors.noCredits;
  out.chat.errors.rateLimit = chat.errors?.rateLimit ?? out.chat.errors.rateLimit;
  out.chat.errors.unexpected = chat.errors?.unexpected ?? out.chat.errors.unexpected;
  out.chat.errors.reset = chat.errors?.reset ?? out.chat.errors.reset;
  out.chat.errors.fallbackReply = chat.fallbackReplyRetry ?? chat.fallbackReply ?? out.chat.errors.fallbackReply;

  out.views.search = chat.echo?.nav?.dashboard ? out.views.search : out.views.search;
  if (chat.echo?.nav) {
    out.nav.settings = chat.echo.nav.settings ?? out.nav.settings;
  }

  return out;
}

function main() {
  if (!fs.existsSync(FULL_LOCALES)) {
    console.error(`Skia-FULL locales not found at ${FULL_LOCALES}`);
    process.exit(1);
  }
  const enTemplate = readJson(path.join(OUT_DIR, "en.json"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const loc of LOCALES) {
    const built = buildFromFull(loc, enTemplate);
    if (!built) continue;
    const outPath = path.join(OUT_DIR, `${loc}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(built, null, 2)}\n`, "utf8");
    console.log(`wrote ${loc}.json`);
  }
}

main();
