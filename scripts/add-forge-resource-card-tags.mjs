#!/usr/bin/env node
/**
 * Add customer-facing card tags to all locale resources.json (no internal filenames).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "public", "locales");

const TAGS_BY_LOCALE = {
  en: {
    productManual: "Overview",
    quickstart: "Start here",
    userGuide: "How to use Forge",
    developerGuide: "Developers",
    apiReference: "API",
    troubleshooting: "Help",
    changelog: "Release notes",
    pricing: "Billing",
    enterprise: "Enterprise",
    securityGuide: "Security",
    support: "Support",
    operatorManual: "Operations",
  },
  fr: {
    productManual: "Aperçu",
    quickstart: "Commencez ici",
    userGuide: "Utiliser Forge",
    developerGuide: "Développeurs",
    apiReference: "API",
    troubleshooting: "Aide",
    changelog: "Notes de version",
    pricing: "Facturation",
    enterprise: "Entreprise",
    securityGuide: "Sécurité",
    support: "Assistance",
    operatorManual: "Opérations",
  },
  es: {
    productManual: "Resumen",
    quickstart: "Empieza aquí",
    userGuide: "Usar Forge",
    developerGuide: "Desarrolladores",
    apiReference: "API",
    troubleshooting: "Ayuda",
    changelog: "Notas de la versión",
    pricing: "Facturación",
    enterprise: "Empresa",
    securityGuide: "Seguridad",
    support: "Soporte",
    operatorManual: "Operaciones",
  },
  de: {
    productManual: "Überblick",
    quickstart: "Hier starten",
    userGuide: "Forge nutzen",
    developerGuide: "Entwickler",
    apiReference: "API",
    troubleshooting: "Hilfe",
    changelog: "Versionshinweise",
    pricing: "Abrechnung",
    enterprise: "Unternehmen",
    securityGuide: "Sicherheit",
    support: "Support",
    operatorManual: "Betrieb",
  },
  pt: {
    productManual: "Visão geral",
    quickstart: "Comece aqui",
    userGuide: "Usar o Forge",
    developerGuide: "Desenvolvedores",
    apiReference: "API",
    troubleshooting: "Ajuda",
    changelog: "Notas de lançamento",
    pricing: "Cobrança",
    enterprise: "Empresarial",
    securityGuide: "Segurança",
    support: "Suporte",
    operatorManual: "Operações",
  },
  ja: {
    productManual: "概要",
    quickstart: "ここから始める",
    userGuide: "Forgeの使い方",
    developerGuide: "開発者向け",
    apiReference: "API",
    troubleshooting: "ヘルプ",
    changelog: "リリースノート",
    pricing: "請求",
    enterprise: "エンタープライズ",
    securityGuide: "セキュリティ",
    support: "サポート",
    operatorManual: "運用",
  },
  ko: {
    productManual: "개요",
    quickstart: "여기서 시작",
    userGuide: "Forge 사용법",
    developerGuide: "개발자",
    apiReference: "API",
    troubleshooting: "도움말",
    changelog: "릴리스 노트",
    pricing: "청구",
    enterprise: "엔터프라이즈",
    securityGuide: "보안",
    support: "지원",
    operatorManual: "운영",
  },
  zh: {
    productManual: "概览",
    quickstart: "从这里开始",
    userGuide: "如何使用 Forge",
    developerGuide: "开发者",
    apiReference: "API",
    troubleshooting: "帮助",
    changelog: "发行说明",
    pricing: "计费",
    enterprise: "企业",
    securityGuide: "安全",
    support: "支持",
    operatorManual: "运维",
  },
  ar: {
    productManual: "نظرة عامة",
    quickstart: "ابدأ هنا",
    userGuide: "استخدام Forge",
    developerGuide: "المطورون",
    apiReference: "API",
    troubleshooting: "مساعدة",
    changelog: "ملاحظات الإصدار",
    pricing: "الفوترة",
    enterprise: "المؤسسات",
    securityGuide: "الأمان",
    support: "الدعم",
    operatorManual: "التشغيل",
  },
  hi: {
    productManual: "अवलोकन",
    quickstart: "यहाँ से शुरू करें",
    userGuide: "Forge का उपयोग",
    developerGuide: "डेवलपर",
    apiReference: "API",
    troubleshooting: "सहायता",
    changelog: "रिलीज़ नोट्स",
    pricing: "बिलिंग",
    enterprise: "एंटरप्राइज़",
    securityGuide: "सुरक्षा",
    support: "समर्थन",
    operatorManual: "संचालन",
  },
  tr: {
    productManual: "Genel bakış",
    quickstart: "Buradan başlayın",
    userGuide: "Forge kullanımı",
    developerGuide: "Geliştiriciler",
    apiReference: "API",
    troubleshooting: "Yardım",
    changelog: "Sürüm notları",
    pricing: "Faturalandırma",
    enterprise: "Kurumsal",
    securityGuide: "Güvenlik",
    support: "Destek",
    operatorManual: "Operasyon",
  },
  ru: {
    productManual: "Обзор",
    quickstart: "Начните здесь",
    userGuide: "Как пользоваться Forge",
    developerGuide: "Разработчикам",
    apiReference: "API",
    troubleshooting: "Помощь",
    changelog: "Примечания к выпуску",
    pricing: "Биллинг",
    enterprise: "Корпоративный",
    securityGuide: "Безопасность",
    support: "Поддержка",
    operatorManual: "Эксплуатация",
  },
};

for (const [locale, tags] of Object.entries(TAGS_BY_LOCALE)) {
  const file = path.join(localesDir, locale, "resources.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [key, tag] of Object.entries(tags)) {
    if (!data.cards[key]) continue;
    data.cards[key].tag = tag;
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`  ${locale}/resources.json`);
}

console.log("[add-forge-resource-card-tags] done");
