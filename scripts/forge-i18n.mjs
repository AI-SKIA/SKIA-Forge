/**
 * Build Forge web locale JSON (en + placeholder copies) and patch public HTML with data-i18n*.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const EN = path.join(PUBLIC, 'locales', 'en');
const LOCALES = ['fr', 'zh', 'es', 'ar', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];

const DOC_FILES = {
  README: 'readme',
  QUICKSTART: 'quickstart',
  USER_GUIDE: 'user-guide',
  DEVELOPER_GUIDE: 'developer-guide',
  API_REFERENCE: 'api-reference',
  OPERATOR_MANUAL: 'operator-manual',
  PRODUCT_MANUAL: 'product-manual',
  SECURITY_GUIDE: 'security-guide',
  TROUBLESHOOTING: 'troubleshooting',
  CHANGELOG: 'changelog',
  SUPPORT: 'support',
  PRICING_AND_PACKAGES: 'pricing-and-packages',
  ENTERPRISE_READINESS_CHECKLIST: 'enterprise-readiness-checklist',
};

function dec(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\uFFFD/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripText(html) {
  return dec(html.replace(/<[^>]+>/g, ' '));
}

function slugify(title) {
  return dec(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function countKeys(obj) {
  let n = 0;
  if (!obj || typeof obj !== 'object') return 0;
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) n += countKeys(v);
    else n += 1;
  }
  return n;
}

function extractSectionBlocks(html) {
  const sections = [];
  const marker = '<div class="section">';
  let searchFrom = 0;
  while (true) {
    const start = html.indexOf(marker, searchFrom);
    if (start < 0) break;
    let depth = 1;
    let i = start + marker.length;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
      } else {
        depth -= 1;
        i = nextClose + 6;
      }
    }
    const blockHtml = html.slice(start, i);
    const titleM = blockHtml.match(/<div class="section-title">([^<]*)<\/div>/);
    if (!titleM) break;
    const title = dec(titleM[1]);
    const bodyOpen = blockHtml.indexOf('<div class="section-body">');
    const bodyHtml =
      bodyOpen >= 0
        ? blockHtml.slice(bodyOpen + '<div class="section-body">'.length, blockHtml.lastIndexOf('</div>')).trim()
        : '';
    sections.push({ start, end: i, title, bodyHtml, key: slugify(title) });
    searchFrom = i;
  }
  return sections;
}

function extractSections(html) {
  const sections = {};
  for (const block of extractSectionBlocks(html)) {
    let key = block.key || 'section';
    if (sections[key]) key = `${key}-${Object.keys(sections).length}`;
    sections[key] = { title: block.title, html: block.bodyHtml };
  }
  return sections;
}

function extractDocPage(html, slug) {
  const titleM = html.match(/<title>([^<]*)<\/title>/i);
  const badgeM = html.match(/<div class="doc-badge">([^<]*)<\/div>/);
  const h1M = html.match(/<h1 class="doc-title">([^<]*)<\/h1>/);
  const descM = html.match(/<p class="doc-desc">([\s\S]*?)<\/p>/);
  return {
    meta: { title: titleM ? dec(titleM[1]) : '' },
    badge: badgeM ? dec(badgeM[1]) : '',
    title: h1M ? dec(h1M[1]) : '',
    description: descM ? stripText(descM[1]) : '',
    sections: extractSections(html),
  };
}

function buildCommon() {
  return {
    meta: { documentTitle: 'SKIA FORGE' },
    sidebar: { tagline: 'She Knows It All' },
    nav: {
      forgeHome: 'Forge Home',
      product: 'Product',
      resources: 'Resources',
      security: 'Security',
      contactSupport: 'Contact & Support',
      downloadForge: 'Download SKIA Forge',
    },
    back: { label: '← Back' },
    aria: { openNavigation: 'Open navigation' },
    footer: {
      tagline: 'One ecosystem. One universe. All SKIA.',
      copyright: '© 2026 SKIA. All rights reserved.',
      resources: 'Resources',
      security: 'Security',
      contactSupport: 'Contact & Support',
    },
  };
}

function buildPlatformDownloads(html) {
  return {
    meta: { title: 'SKIA FORGE' },
    hero: {
      title: 'SKIA Forge',
      subtitle:
        'Governed intelligence for real software delivery — built for operators, developers, and production teams',
      downloadButton: 'Download SKIA Forge',
    },
    cards: {
      frontier: {
        title: 'Frontier-Ready Intelligence Layer',
        brand: 'SKIA Forge',
        body: 'SKIA Forge is built on a hardened intelligence stack validated across coding, tool use, reasoning, long context, vision, and multimodal workflows.',
      },
      reliability: {
        title: 'Verified Reliability',
        brand: 'SKIA Forge',
        body: 'Every release is verified before it ships. Quality is protected end-to-end so you get stable, trustworthy outputs every time.',
      },
      operations: {
        title: 'Production-Grade Operations',
        brand: 'SKIA Forge',
        body: 'Forge ships with health checks, governance telemetry, status surfaces, and deterministic routing controls designed for operational trust.',
      },
      surfaces: {
        title: 'One Intelligence Across Surfaces',
        brand: 'SKIA Forge',
        body: 'Use Forge on the web for API-powered execution, or install desktop for full local filesystem and terminal workflows.',
      },
    },
    docLinks: {
      overview: { title: 'Overview', sub: 'PRODUCT OVERVIEW', desc: 'Orientation and high-level view of SKIA Forge on the Forge site.' },
      api: { title: 'API reference', sub: 'HTTP API', desc: 'HTTP and integration endpoints for Forge-powered execution.' },
      quickstart: { title: 'Quickstart', sub: 'GET STARTED', desc: 'Download the IDE, sign in, and run your first governed workflow.' },
      userGuide: { title: 'User guide', sub: 'DAY-TO-DAY USE', desc: 'Using the IDE: sign-in, workflows, governance modes, and help.' },
      developerGuide: { title: 'Developer guide', sub: 'INTEGRATION & EXTENSION', desc: 'Architecture, extension points, and integration patterns.' },
      productManual: { title: 'Product manual', sub: 'FULL PRODUCT REFERENCE', desc: 'Deep product behavior, surfaces, and operational semantics.' },
      enterprise: { title: 'Enterprise readiness', sub: 'ENTERPRISE DEPLOYMENT', desc: 'Checklist and signals for regulated or large-team rollout.' },
      pricing: { title: 'Pricing & packages', sub: 'PLANS & PRICING', desc: 'Commercial packaging and procurement-facing detail.' },
      troubleshooting: { title: 'Troubleshooting', sub: 'DIAGNOSTICS & FIXES', desc: 'Known failure modes, diagnostics, and recovery steps.' },
      support: { title: 'Support', sub: 'GET HELP', desc: 'How to get help and escalate issues through Forge support.' },
      securityGuide: { title: 'Security guide', sub: 'SECURITY & HARDENING', desc: 'Threat model, hardening, and safe deployment practices.' },
    },
    installers: {
      heading: 'SKIA Forge PC app installers',
      windows: { title: 'Windows', sub: 'PC APP INSTALLER', desc: 'Windows 10/11', hint: '64-bit installer (.exe)' },
      macIntel: { title: 'macOS (Intel)', sub: 'PC APP INSTALLER', desc: 'macOS 11+', hint: 'Intel x64' },
      macArm: { title: 'macOS (Apple Silicon)', sub: 'PC APP INSTALLER', desc: 'macOS 11+ M1/M2/M3', hint: 'Apple Silicon (M1/M2/M3)' },
      linux: { title: 'Linux', sub: 'PC APP INSTALLER', desc: 'Ubuntu, Fedora, Arch', hint: 'AppImage (any distro)' },
      windowsAria: 'Download SKIA Forge for Windows',
      macIntelAria: 'Download SKIA Forge for macOS Intel',
      macArmAria: 'Download SKIA Forge for Apple Silicon',
      linuxAria: 'Download SKIA Forge for Linux',
    },
    howItWorks: {
      heading: 'How Forge + SKIA works',
      step1: 'Use Forge on the web for immediate access, or install desktop for full local workflow control.',
      step2: 'Choose the right execution path: context, agent, SDLC, production, healing, and architecture.',
      step3: 'Get structured outputs designed for real use, not generic draft text.',
    },
    whyTeams: {
      heading: 'Why teams choose SKIA Forge',
      a: 'Benchmark-aligned quality on your critical dimensions: coding, tools, reasoning, long context, vision, and TTS.',
      b: 'System-level maturity beyond raw output: observability, health checks, and integration governance built for production environments.',
      c: 'Truth-based release distribution: only published installers are shown for download.',
    },
  };
}

function buildResources() {
  return {
    meta: { title: 'Resources | SKIA Forge' },
    hero: { title: 'Resources', subtitle: 'Everything you need to understand, deploy, and operate SKIA Forge' },
    quickLinks: { download: 'Download SKIA Forge', releaseNotes: 'Release Notes', contactSupport: 'Contact Support' },
    sections: { documentation: 'Documentation', operators: 'For operators' },
    cards: {
      productManual: { title: 'Product Manual', desc: 'Full product overview, capabilities, and feature positioning for SKIA Forge.' },
      quickstart: { title: 'Quickstart', desc: 'Download the IDE, sign in, and complete your first workflow.' },
      userGuide: { title: 'User Guide', desc: 'Using the IDE: sign-in, daily workflows, governance modes, and help.' },
      developerGuide: { title: 'Developer Guide', desc: 'Local development setup, architecture conventions, and contribution patterns.' },
      apiReference: { title: 'API Reference', desc: 'Primary Forge API surfaces, endpoints, request shapes, and response contracts.' },
      troubleshooting: { title: 'Troubleshooting', desc: 'Common failure modes, diagnostics, and step-by-step fixes.' },
      changelog: { title: 'Changelog', desc: 'Versioned product change history. What changed, when, and why.' },
      pricing: { title: 'Pricing & Packages', desc: 'Product packaging, tiers, and commercial model overview.' },
      enterprise: { title: 'Enterprise Readiness', desc: 'Enterprise launch and pilot readiness checklist for IT and procurement teams.' },
      securityGuide: { title: 'Security Guide', desc: 'Security model, controls, hardening checklist, and operational security practices.' },
      support: { title: 'Support', desc: 'Support scope, triage information, escalation path, and SLA expectations.' },
      operatorManual: { title: 'Operator Manual', desc: 'Deployment, runtime operations, health checks, and infrastructure guidance.' },
    },
  };
}

function buildSecurity() {
  return {
    meta: { title: 'Security | SKIA Forge' },
    hero: {
      title: 'Security',
      subtitle: 'SKIA Forge applies layered controls across every surface — request, governance, and execution',
    },
    sections: {
      model: 'Security Model',
      components: 'Key Security Components',
      practices: 'Operational Security Practices',
      checklist: 'Hardening Checklist',
    },
    controls: {
      validation: { title: 'Request Validation', desc: 'All inputs validated against strict request and schema contracts before execution.' },
      governance: { title: 'Governance Enforcement', desc: 'Strict, adaptive, and autonomous governance modes control what agents can do.' },
      safety: { title: 'Safety Gates', desc: 'High-risk actions pass through safety gates with preview and policy-based blocking.' },
      previews: { title: 'Execution Previews', desc: 'Every destructive or irreversible action is previewed before it runs.' },
    },
    components: {
      analysis: 'Security analysis — runs scan and save-time checks on code and agent output before persistence.',
      governance: 'Governance layer — enforces strict / adaptive / autonomous control based on user-defined policy. All mode transitions are logged.',
      routes: 'Route & Action Modules — per-route and per-action safety constraints that cannot be bypassed at the API layer.',
      audit: 'Audit Trail — all orchestration runs produce a structured audit trail. Reviewed after major agent operations.',
    },
    practices: {
      p1: "Keep secrets out of repositories and logs. Store all secrets using your secrets manager or hosting provider's secrets injection — never in plaintext config files.",
      p2: 'Validate all external integration responses. Never trust third-party data without schema assertion.',
      p3: 'Treat policy blocks as first-class security events. Every block is logged, reviewable, and feeds governance tuning.',
      p4: 'Record and monitor remediation outcomes. Fixes without follow-up validation are not considered complete.',
    },
    checklist: {
      c1: 'Run lint, typecheck, and tests before every release',
      c2: 'Keep all dependencies current — patch within 48 hours of CVE',
      c3: 'Validate integration probe endpoints regularly',
      c4: 'Review audit trails after major orchestration runs',
      c5: 'Rotate JWT_SECRET and API keys on a scheduled cadence',
      c6: 'Never commit secrets — use environment variable injection',
    },
    disclosure: {
      title: 'Responsible Disclosure',
      body: 'Found a vulnerability in SKIA Forge? We take security reports seriously. Contact us privately and we will respond within one business day.',
      button: 'Report a Vulnerability',
    },
  };
}

function buildContact() {
  return {
    meta: { title: 'Contact & Support | SKIA Forge' },
    hero: {
      title: 'Contact & Support',
      subtitle:
        "SKIA Forge runtime and SKIA Forge IDE — startup, updates, integrations, governance, or getting started — we're here",
    },
    sections: {
      scope: 'Support Scope',
      sla: 'Response Expectations',
      triage: 'When Reporting an Issue — Include',
      escalation: 'Escalation Path',
      form: 'Send a Message',
    },
    scope: {
      s1: 'Runtime startup and health issues',
      s2: 'Integration contract failures',
      s3: 'Governance and policy flow debugging',
      s4: 'Workflow failures and integration issues',
      s5: 'SKIA Forge IDE install, updates, and desktop runtime',
      s6: 'General usage and workflow questions',
    },
    sla: {
      p1: { label: 'Critical Outage', desc: 'Complete loss of service or data integrity risk. Immediate response window.' },
      p2: { label: 'Degraded Service', desc: 'Core functionality impaired but workaround exists. Same business day response.' },
      p3: { label: 'Non-blocking Issue', desc: 'Minor issues, questions, feature requests. Prioritized backlog response.' },
    },
    triage: {
      t1: 'Endpoint and HTTP method',
      t2: 'Request timestamp',
      t3: 'Request ID or correlation ID (if available)',
      t4: 'Governance mode: strict / adaptive / autonomous',
      t5: 'Full error message and stack trace',
      t6: 'Steps to reproduce reliably',
      t7: 'SKIA Forge IDE version or build channel (if using the desktop app)',
    },
    escalation: {
      e1: 'Reproduce locally and validate with health and probe endpoints to isolate the failure surface.',
      e2: 'Apply remediation guidance from control-plane outputs and check the Troubleshooting docs.',
      e3: 'Escalate via the form below with logs, payload shape, and expected vs actual behaviour.',
    },
    form: {
      namePlaceholder: 'Name',
      emailPlaceholder: 'Email',
      topicAria: 'Topic',
      topicSupport: 'Topic — Support (runtime, integration, governance)',
      topicCx: 'Topic — Customer Service (account, billing, general)',
      subjectPlaceholder: 'Subject',
      messagePlaceholder: 'Describe your issue or question...',
      submit: 'Send Message',
      sending: 'Sending...',
      directPrefix: 'Or reach us directly at:',
      fillAll: 'Please fill in all fields.',
      success: "Message sent. We'll get back to you shortly.",
      failedPrefix: 'Failed to send. Please email us at ',
    },
  };
}

function patchCommonChrome(html) {
  let out = html;
  out = out.replace(/<html lang="[^"]*"/i, '<html lang="en"');
  if (!/<title[^>]*data-i18n=/.test(out)) {
    out = out.replace(/<title>[^<]*<\/title>/i, '<title data-i18n="common.meta.documentTitle"></title>');
  }
  if (!out.includes('data-i18n="common.sidebar.tagline"')) {
    out = out.replace(
      /<span class="pc-sidebar-logo-tagline">[^<]*<\/span>/,
      '<span class="pc-sidebar-logo-tagline" data-i18n="common.sidebar.tagline"></span>',
    );
  }
  const navKeys = [
    'common.nav.forgeHome',
    'common.nav.product',
    'common.nav.resources',
    'common.nav.security',
    'common.nav.contactSupport',
    'common.nav.downloadForge',
  ];
  let ni = 0;
  out = out.replace(/<a class="pc-sidebar-btn[^"]*"([^>]*)>([^<]*)<\/a>/g, (m, attrs) => {
    if (attrs.includes('data-i18n=')) return m;
    const k = navKeys[ni++] ?? navKeys[0];
    return `<a class="pc-sidebar-btn"${attrs} data-i18n="${k}"></a>`;
  });
  out = out.replace(/<button([^>]*class="back-btn"[^>]*)>[^<]*<\/button>/g, (m, attrs) => {
    if (attrs.includes('data-i18n=')) return m;
    return `<button${attrs} data-i18n="common.back.label"></button>`;
  });
  out = out.replace(/(<button[^>]*class="pc-sidebar-tab"[^>]*)(>)/g, (m, attrs, close) => {
    if (attrs.includes('data-i18n-aria-label=')) return m;
    const withAria = attrs.includes('aria-label="Open navigation"')
      ? attrs
      : `${attrs} aria-label="Open navigation"`;
    return `${withAria} data-i18n-aria-label="common.aria.openNavigation"${close}`;
  });
  out = out.replace(/<div class="footer-tagline">[^<]*<\/div>/g, '<div class="footer-tagline" data-i18n="common.footer.tagline"></div>');
  out = out.replace(/<div class="footer-copy">[^<]*<\/div>/g, '<div class="footer-copy" data-i18n="common.footer.copyright"></div>');
  out = out.replace(/<div class="tagline">[^<]*<\/div>/g, '<div class="tagline" data-i18n="common.footer.tagline"></div>');
  out = out.replace(/<div class="copy">[^<]*<\/div>/g, '<div class="copy" data-i18n="common.footer.copyright"></div>');
  const fl = ['common.footer.resources', 'common.footer.security', 'common.footer.contactSupport'];
  let fi = 0;
  const patchFooterLinks = (block) =>
    block.replace(/<a([^>]*)>([^<]*)<\/a>/g, (ma, a) => {
      if (a.includes('data-i18n=')) return ma;
      const k = fl[fi++] ?? fl[0];
      return `<a${a} data-i18n="${k}"></a>`;
    });
  out = out.replace(/<div class="footer-links">([\s\S]*?)<\/div>/g, (m, inner) => {
    fi = 0;
    return `<div class="footer-links">${patchFooterLinks(inner)}</div>`;
  });
  out = out.replace(/<div class="links">([\s\S]*?)<\/div>/g, (m, inner) => {
    fi = 0;
    return `<div class="links">${patchFooterLinks(inner)}</div>`;
  });
  return out;
}

function addScripts(html) {
  if (!html.includes('forge-page-locale.js')) {
    html = html.replace(
      '<script src="/forge-sidebar-locale.js" defer></script>',
      '<script src="/forge-page-locale.js" defer></script>\n  <script src="/forge-sidebar-locale.js" defer></script>',
    );
  }
  return html;
}

function cleanupHtml(html) {
  return html
    .replace(/(data-i18n(?:-html|-placeholder|-aria-label)?="[^"]*")\s+\1/g, '$1')
    .replace(/\sdata-i18n-\s/g, ' ')
    .replace(/\sdata-i18n-\s*data-i18n/g, ' data-i18n');
}

function patchPlatformDownloads(html) {
  let out = patchCommonChrome(html);
  out = out.replace('<title data-i18n="common.meta.documentTitle"></title>', '<title data-i18n="platform-downloads.meta.title"></title>');
  out = out.replace(/<body[^>]*>/, '<body data-forge-i18n-page="platform-downloads">');
  out = out.replace(/<h1 class="page-title">[^<]*<\/h1>/, '<h1 class="page-title" data-i18n="platform-downloads.hero.title"></h1>');
  out = out.replace(/<p class="page-subtitle">[\s\S]*?<\/p>/, '<p class="page-subtitle" data-i18n="platform-downloads.hero.subtitle"></p>');
  out = out.replace(
    /<a href="\/api\/app\/download" class="feature-tab feature-tab--active">\s*[^<]*\s*<\/a>/,
    '<a href="/api/app/download" class="feature-tab feature-tab--active" data-i18n="platform-downloads.hero.downloadButton"></a>',
  );
  const panelKeys = ['frontier', 'reliability', 'operations', 'surfaces'];
  let pi = 0;
  out = out.replace(/<article class="doc-card doc-card--panel">([\s\S]*?)<\/article>/g, (m, inner) => {
    const k = panelKeys[pi++] ?? 'frontier';
    return `<article class="doc-card doc-card--panel">${inner
      .replace(/<div class="doc-card-title">[^<]*<\/div>/, `<div class="doc-card-title" data-i18n="platform-downloads.cards.${k}.title"></div>`)
      .replace(/<div class="doc-card-sub">[^<]*<\/div>/, `<div class="doc-card-sub" data-i18n="platform-downloads.cards.${k}.brand"></div>`)
      .replace(/<div class="doc-card-desc">[^<]*<\/div>/, `<div class="doc-card-desc" data-i18n="platform-downloads.cards.${k}.body"></div>`)}</article>`;
  });
  const docKeys = ['overview', 'api', 'quickstart', 'userGuide', 'developerGuide', 'productManual', 'enterprise', 'pricing', 'troubleshooting', 'support', 'securityGuide'];
  const docHrefs = ['README', 'API_REFERENCE', 'QUICKSTART', 'USER_GUIDE', 'DEVELOPER_GUIDE', 'PRODUCT_MANUAL', 'ENTERPRISE_READINESS_CHECKLIST', 'PRICING_AND_PACKAGES', 'TROUBLESHOOTING', 'SUPPORT', 'SECURITY_GUIDE'];
  let di = 0;
  out = out.replace(/<a href="\/docs\/[^"]+\.html" class="doc-card">([\s\S]*?)<\/a>/g, (m, inner) => {
    const k = docKeys[di] ?? 'overview';
    const href = docHrefs[di] ?? 'README';
    di++;
    return `<a href="/docs/${href}.html" class="doc-card">${inner
      .replace(/<div class="doc-card-title">[^<]*<\/div>/, `<div class="doc-card-title" data-i18n="platform-downloads.docLinks.${k}.title"></div>`)
      .replace(/<div class="doc-card-sub">[^<]*<\/div>/, `<div class="doc-card-sub" data-i18n="platform-downloads.docLinks.${k}.sub"></div>`)
      .replace(/<div class="doc-card-desc">[^<]*<\/div>/, `<div class="doc-card-desc" data-i18n="platform-downloads.docLinks.${k}.desc"></div>`)}</a>`;
  });
  out = out.replace(/<p class="download-web-text">SKIA Forge PC app installers<\/p>/, '<p class="download-web-text" data-i18n="platform-downloads.installers.heading"></p>');
  const inst = ['windows', 'macIntel', 'macArm', 'linux'];
  const instAria = ['windowsAria', 'macIntelAria', 'macArmAria', 'linuxAria'];
  let ii = 0;
  out = out.replace(/<a href="(\/api\/app\/download\/[^"]+)" class="doc-card"([^>]*)>([\s\S]*?)<\/a>/g, (m, href, attrs, inner) => {
    const k = inst[ii] ?? 'windows';
    const aKey = instAria[ii] ?? 'windowsAria';
    ii++;
    const cleanAttrs = attrs.replace(/\s*aria-label="[^"]*"/, '').replace(/\s*data-i18n-aria-label="[^"]*"/, '').trim();
    const attrSuffix = cleanAttrs ? ` ${cleanAttrs}` : '';
    return `<a href="${href}" class="doc-card"${attrSuffix} data-i18n-aria-label="platform-downloads.installers.${aKey}">${inner
      .replace(/<div class="doc-card-title">[^<]*<\/div>/, `<div class="doc-card-title" data-i18n="platform-downloads.installers.${k}.title"></div>`)
      .replace(/<div class="doc-card-sub">[^<]*<\/div>/, `<div class="doc-card-sub" data-i18n="platform-downloads.installers.${k}.sub"></div>`)
      .replace(/<div class="doc-card-desc">([\s\S]*?)<\/div>/, `<div class="doc-card-desc" data-i18n="platform-downloads.installers.${k}.desc"></div>`)
      .replace(/<span class="platform-downloads-installer-hint">[^<]*<\/span>/, `<span class="platform-downloads-installer-hint" data-i18n="platform-downloads.installers.${k}.hint"></span>`)}</a>`;
  });
  out = out.replace(/<p class="download-web-text">How Forge \+ SKIA works<\/p>/, '<p class="download-web-text" data-i18n="platform-downloads.howItWorks.heading"></p>');
  const how = ['step1', 'step2', 'step3'];
  let hi = 0;
  out = out.replace(/<div class="download-instructions">([\s\S]*?)<\/div>\s*<div class="download-web-option" style="margin-top:18px;">/g, (m, block) => {
    const patched = block.replace(/<span>([^<]*)<\/span>/g, () => `<span data-i18n="platform-downloads.howItWorks.${how[hi++]}"></span>`);
    return `${patched}</div>\n\n  <div class="download-web-option" style="margin-top:18px;">`;
  });
  out = out.replace(/<p class="download-web-text">Why teams choose SKIA Forge<\/p>/, '<p class="download-web-text" data-i18n="platform-downloads.whyTeams.heading"></p>');
  const why = ['a', 'b', 'c'];
  let wi = 0;
  out = out.replace(/<div class="download-instructions">([\s\S]*?)<\/div>\s*<footer>/g, (m, block) => {
    const patched = block.replace(/<span>([^<]*)<\/span>/g, () => `<span data-i18n="platform-downloads.whyTeams.${why[wi++]}"></span>`);
    return `${patched}</div>\n\n  <footer>`;
  });
  return addScripts(out);
}

function patchResources(html) {
  let out = patchCommonChrome(html);
  out = out.replace('<title data-i18n="common.meta.documentTitle"></title>', '<title data-i18n="resources.meta.title"></title>');
  out = out.replace(/<body[^>]*>/, '<body data-forge-i18n-page="resources">');
  out = out.replace(/<h1 class="page-title">[^<]*<\/h1>/, '<h1 class="page-title" data-i18n="resources.hero.title"></h1>');
  out = out.replace(/<p class="page-subtitle">[^<]*<\/p>/, '<p class="page-subtitle" data-i18n="resources.hero.subtitle"></p>');
  const ql = ['download', 'releaseNotes', 'contactSupport'];
  let qi = 0;
  out = out.replace(/<div class="quick-links">([\s\S]*?)<\/div>/, (m, inner) => {
    const patched = inner.replace(/<a ([^>]+)>([^<]*)<\/a>/g, (ma, attrs) => {
      const k = ql[qi++] ?? 'download';
      return `<a ${attrs} data-i18n="resources.quickLinks.${k}"></a>`;
    });
    return `<div class="quick-links">${patched}</div>`;
  });
  out = out.replace(/<div class="section-label">Documentation<\/div>/, '<div class="section-label" data-i18n="resources.sections.documentation"></div>');
  out = out.replace(
    /<div class="section-label"[^>]*>For operators<\/div>/,
    '<div class="section-label" style="margin-top:32px;" data-i18n="resources.sections.operators"></div>',
  );
  const cardKeys = ['productManual', 'quickstart', 'userGuide', 'developerGuide', 'apiReference', 'troubleshooting', 'changelog', 'pricing', 'enterprise', 'securityGuide', 'support', 'operatorManual'];
  let ci = 0;
  out = out.replace(/<a href="\/docs\/[^"]+\.html" class="doc-card">([\s\S]*?)<\/a>/g, (m, inner) => {
    const k = cardKeys[ci++] ?? 'productManual';
    return m.replace(
      inner,
      inner
        .replace(/<div class="doc-card-title">[^<]*<\/div>/, `<div class="doc-card-title" data-i18n="resources.cards.${k}.title"></div>`)
        .replace(/<div class="doc-card-desc">[^<]*<\/div>/, `<div class="doc-card-desc" data-i18n="resources.cards.${k}.desc"></div>`),
    );
  });
  return addScripts(out);
}

function patchSecurityPage(html) {
  let out = patchCommonChrome(html);
  out = out.replace('<title data-i18n="common.meta.documentTitle"></title>', '<title data-i18n="security.meta.title"></title>');
  out = out.replace(/<body[^>]*>/, '<body data-forge-i18n-page="security">');
  out = out.replace(/<h1 class="page-title">[^<]*<\/h1>/, '<h1 class="page-title" data-i18n="security.hero.title"></h1>');
  out = out.replace(/<p class="page-subtitle">[^<]*<\/p>/, '<p class="page-subtitle" data-i18n="security.hero.subtitle"></p>');
  const sectionKeys = ['model', 'components', 'practices', 'checklist'];
  let si = 0;
  out = out.replace(/<div class="section-label">([^<]*)<\/div>/g, () => {
    const k = sectionKeys[si++] ?? 'model';
    return `<div class="section-label" data-i18n="security.sections.${k}"></div>`;
  });
  const ctrl = ['validation', 'governance', 'safety', 'previews'];
  let ci = 0;
  out = out.replace(/<div class="control-title">([^<]*)<\/div>/g, () => {
    const k = ctrl[ci++] ?? 'validation';
    return `<div class="control-title" data-i18n="security.controls.${k}.title"></div>`;
  });
  ci = 0;
  out = out.replace(/<div class="control-desc">([^<]*)<\/div>/g, () => {
    const k = ctrl[ci++] ?? 'validation';
    return `<div class="control-desc" data-i18n="security.controls.${k}.desc"></div>`;
  });
  const comp = ['analysis', 'governance', 'routes', 'audit'];
  let ki = 0;
  out = out.replace(/<div class="kc-text">([\s\S]*?)<\/div>/g, (m, inner) => {
    const k = comp[ki++] ?? 'analysis';
    return `<div class="kc-text" data-i18n="security.components.${k}"></div>`;
  });
  const pr = ['p1', 'p2', 'p3', 'p4'];
  let pi = 0;
  out = out.replace(/<div class="practice-text">([^<]*)<\/div>/g, () => {
    const k = pr[pi++] ?? 'p1';
    return `<div class="practice-text" data-i18n="security.practices.${k}"></div>`;
  });
  const ch = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  let chi = 0;
  out = out.replace(/<div class="check-text">([^<]*)<\/div>/g, () => {
    const k = ch[chi++] ?? 'c1';
    return `<div class="check-text" data-i18n="security.checklist.${k}"></div>`;
  });
  out = out.replace(/<h3>Responsible Disclosure<\/h3>/, '<h3 data-i18n="security.disclosure.title"></h3>');
  out = out.replace(/<p>Found a vulnerability[\s\S]*?<\/p>/, '<p data-i18n="security.disclosure.body"></p>');
  out = out.replace(/<a href="\/contact" class="report-btn">[^<]*<\/a>/, '<a href="/contact" class="report-btn" data-i18n="security.disclosure.button"></a>');
  return addScripts(out);
}

function patchContactPage(html) {
  let out = patchCommonChrome(html);
  out = out.replace('<title data-i18n="common.meta.documentTitle"></title>', '<title data-i18n="contact.meta.title"></title>');
  out = out.replace(/<body[^>]*>/, '<body data-forge-i18n-page="contact">');
  out = out.replace(/<h1 class="page-title">[^<]*<\/h1>/, '<h1 class="page-title" data-i18n="contact.hero.title"></h1>');
  out = out.replace(/<p class="page-subtitle">[^<]*<\/p>/, '<p class="page-subtitle" data-i18n="contact.hero.subtitle"></p>');
  const sec = ['scope', 'sla', 'triage', 'escalation', 'form'];
  let si = 0;
  out = out.replace(/<div class="section-label"[^>]*>([^<]*)<\/div>/g, () => {
    const k = sec[si++] ?? 'scope';
    return `<div class="section-label" data-i18n="contact.sections.${k}"></div>`;
  });
  const sc = ['s1', 's2', 's3', 's4', 's5', 's6'];
  let sci = 0;
  out = out.replace(/<div class="scope-text">([^<]*)<\/div>/g, () => {
    const k = sc[sci++] ?? 's1';
    return `<div class="scope-text" data-i18n="contact.scope.${k}"></div>`;
  });
  const slaL = ['p1', 'p2', 'p3'];
  let sli = 0;
  out = out.replace(/<div class="sla-label"([^>]*)>([^<]*)<\/div>/g, (m, attrs) => {
    if (attrs.includes('data-i18n=')) return m;
    const k = slaL[sli++] ?? 'p1';
    return `<div class="sla-label" data-i18n="contact.sla.${k}.label"></div>`;
  });
  let sdi = 0;
  out = out.replace(/<div class="sla-desc"([^>]*)>([^<]*)<\/div>/g, (m, attrs) => {
    if (attrs.includes('data-i18n=')) return m;
    const k = slaL[sdi++] ?? 'p1';
    return `<div class="sla-desc" data-i18n="contact.sla.${k}.desc"></div>`;
  });
  const tr = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
  let ti = 0;
  out = out.replace(/<div class="triage-item"><div class="triage-dot"><\/div>([^<]*)<\/div>/g, () => {
    const k = tr[ti++] ?? 't1';
    return `<div class="triage-item"><div class="triage-dot"></div><span data-i18n="contact.triage.${k}"></span></div>`;
  });
  const es = ['e1', 'e2', 'e3'];
  let ei = 0;
  out = out.replace(/<div class="esc-text">([^<]*)<\/div>/g, () => {
    const k = es[ei++] ?? 'e1';
    return `<div class="esc-text" data-i18n="contact.escalation.${k}"></div>`;
  });
  out = out.replace(/placeholder="Name"/, 'placeholder="" data-i18n-placeholder="contact.form.namePlaceholder"');
  out = out.replace(/placeholder="Email"/, 'placeholder="" data-i18n-placeholder="contact.form.emailPlaceholder"');
  if (!out.includes('data-i18n-aria-label="contact.form.topicAria"')) {
    out = out.replace(/aria-label="Topic"/, 'aria-label="Topic" data-i18n-aria-label="contact.form.topicAria"');
  }
  out = out.replace(
    /<option value="support">[^<]*<\/option>/,
    '<option value="support" data-i18n="contact.form.topicSupport"></option>',
  );
  out = out.replace(/<option value="cx">[^<]*<\/option>/, '<option value="cx" data-i18n="contact.form.topicCx"></option>');
  out = out.replace(/placeholder="Subject"/, 'placeholder="" data-i18n-placeholder="contact.form.subjectPlaceholder"');
  out = out.replace(
    /placeholder="Describe your issue or question\.\.\."/,
    'placeholder="" data-i18n-placeholder="contact.form.messagePlaceholder"',
  );
  out = out.replace(/<button class="submit-btn" id="submitBtn">[^<]*<\/button>/, '<button class="submit-btn" id="submitBtn" data-i18n="contact.form.submit"></button>');
  out = out.replace(/Or reach us directly at:/, '<span data-i18n="contact.form.directPrefix"></span>');
  out = out.replace(
    /status\.textContent='Please fill in all fields\.';/g,
    "status.textContent=(window.__forgeContactI18n&&window.__forgeContactI18n.fillAll)||'Please fill in all fields.';",
  );
  out = out.replace(/btn\.textContent='Sending\.\.\.';/g, "btn.textContent=(window.__forgeContactI18n&&window.__forgeContactI18n.sending)||'Sending...';");
  out = out.replace(
    /status\.textContent="Message sent\. We'll get back to you shortly\.";/g,
    'status.textContent=(window.__forgeContactI18n&&window.__forgeContactI18n.success)||"Message sent.";',
  );
  out = out.replace(
    /status\.textContent='Failed to send\. Please email us at ' \+ fallback;/g,
    "status.textContent=((window.__forgeContactI18n&&window.__forgeContactI18n.failedPrefix)||'Failed to send. Please email us at ')+fallback;",
  );
  out = out.replace(/btn\.textContent='Send Message';$/m, "btn.textContent=(window.__forgeContactI18n&&window.__forgeContactI18n.submit)||'Send Message';");
  return addScripts(out);
}

function patchDocPage(html, slug) {
  let out = html;
  const blocks = extractSectionBlocks(html);
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const b = blocks[bi];
    const replacement = `<div class="section"><div class="section-title" data-i18n="docs.pages.${slug}.sections.${b.key}.title"></div><div class="section-body" data-i18n-html="docs.pages.${slug}.sections.${b.key}.html"></div></div>`;
    out = out.slice(0, b.start) + replacement + out.slice(b.end);
  }
  out = patchCommonChrome(out);
  out = out.replace('<title data-i18n="common.meta.documentTitle"></title>', `<title data-i18n="docs.pages.${slug}.meta.title"></title>`);
  out = out.replace(/<body[^>]*>/, `<body data-forge-i18n-page="docs" data-forge-i18n-slug="${slug}">`);
  out = out.replace(/<div class="doc-badge">[^<]*<\/div>/, `<div class="doc-badge" data-i18n="docs.pages.${slug}.badge"></div>`);
  out = out.replace(/<h1 class="doc-title">[^<]*<\/h1>/, `<h1 class="doc-title" data-i18n="docs.pages.${slug}.title"></h1>`);
  out = out.replace(/<p class="doc-desc">[\s\S]*?<\/p>/, `<p class="doc-desc" data-i18n="docs.pages.${slug}.description"></p>`);
  return addScripts(out);
}

const docsOnly = process.argv.includes('--docs-only');
const contactOnly = process.argv.includes('--contact-only');
const skipDocsPatch = process.argv.includes('--skip-docs-patch');
const skipDocsExtract = process.argv.includes('--skip-docs-extract');

function writeLocaleFiles(bundles) {
  fs.mkdirSync(EN, { recursive: true });
  for (const [name, data] of Object.entries(bundles)) {
    fs.writeFileSync(path.join(EN, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
  }
  for (const loc of LOCALES) {
    const dir = path.join(PUBLIC, 'locales', loc);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(EN)) {
      fs.copyFileSync(path.join(EN, f), path.join(dir, f));
    }
  }
}

function buildBundles(pdHtml) {
  const bundles = {
    common: buildCommon(),
    'platform-downloads': buildPlatformDownloads(pdHtml),
    resources: buildResources(),
    security: buildSecurity(),
    contact: buildContact(),
    docs: { pages: {} },
  };
  if (skipDocsExtract && fs.existsSync(path.join(EN, 'docs.json'))) {
    bundles.docs = JSON.parse(fs.readFileSync(path.join(EN, 'docs.json'), 'utf8'));
  } else {
    for (const [file, slug] of Object.entries(DOC_FILES)) {
      const html = fs.readFileSync(path.join(PUBLIC, 'docs', `${file}.html`), 'utf8');
      if (html.includes('data-forge-i18n-page="docs"')) {
        throw new Error(
          `${file}.html is already i18n-patched. Restore pristine docs before extract: git checkout HEAD -- public/docs/`,
        );
      }
      bundles.docs.pages[slug] = extractDocPage(html, slug);
    }
  }
  return bundles;
}

const pdHtml = fs.readFileSync(path.join(PUBLIC, 'platform-downloads.html'), 'utf8');
const bundles = buildBundles(pdHtml);
writeLocaleFiles(bundles);

if (contactOnly) {
  fs.writeFileSync(
    path.join(PUBLIC, 'contact.html'),
    cleanupHtml(patchContactPage(fs.readFileSync(path.join(PUBLIC, 'contact.html'), 'utf8'))),
  );
} else if (!docsOnly) {
  fs.writeFileSync(path.join(PUBLIC, 'platform-downloads.html'), cleanupHtml(patchPlatformDownloads(pdHtml)));
  fs.writeFileSync(
    path.join(PUBLIC, 'resources.html'),
    cleanupHtml(patchResources(fs.readFileSync(path.join(PUBLIC, 'resources.html'), 'utf8'))),
  );
  fs.writeFileSync(
    path.join(PUBLIC, 'security.html'),
    cleanupHtml(patchSecurityPage(fs.readFileSync(path.join(PUBLIC, 'security.html'), 'utf8'))),
  );
  fs.writeFileSync(
    path.join(PUBLIC, 'contact.html'),
    cleanupHtml(patchContactPage(fs.readFileSync(path.join(PUBLIC, 'contact.html'), 'utf8'))),
  );
}

if (!skipDocsPatch && (docsOnly || !contactOnly)) {
  // docs-only or full run (not contact-only)
  for (const [file, slug] of Object.entries(DOC_FILES)) {
    const fp = path.join(PUBLIC, 'docs', `${file}.html`);
    const html = fs.readFileSync(fp, 'utf8');
    if (html.includes('data-forge-i18n-page="docs"')) continue;
    fs.writeFileSync(fp, cleanupHtml(patchDocPage(html, slug)));
  }
}

const counts = {};
for (const f of fs.readdirSync(EN)) counts[f] = countKeys(JSON.parse(fs.readFileSync(path.join(EN, f), 'utf8')));
console.log('Locale key counts:', JSON.stringify(counts, null, 2));
