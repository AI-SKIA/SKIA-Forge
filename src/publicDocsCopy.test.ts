import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERNAL_MARKERS = [/Skia-FULL/, /GOOGLE_AI_API_KEY/, /GOOGLE_API_KEY/, /skia-ide\/dist/, /northflank/i];

function publicDocFiles(): string[] {
  const md = fs
    .readdirSync(path.join(root, "docs"), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(root, "docs", e.name));
  const html = fs
    .readdirSync(path.join(root, "public", "docs"))
    .filter((n) => n.endsWith(".html"))
    .map((n) => path.join(root, "public", "docs", n));
  const localeDocs = fs
    .readdirSync(path.join(root, "public", "locales"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, "public", "locales", e.name, "docs.json"))
    .filter((p) => fs.existsSync(p));
  return [...md, ...html, ...localeDocs];
}

test("customer docs served at /docs carry no internal repo, provider-key or build-path references", () => {
  const leaks: string[] = [];
  for (const file of publicDocFiles()) {
    const text = fs.readFileSync(file, "utf8");
    for (const marker of INTERNAL_MARKERS) {
      if (marker.test(text)) leaks.push(`${path.relative(root, file)}: ${marker}`);
    }
  }
  assert.deepEqual(leaks, []);
});

test("/docs refuses internal contracts and architecture folders", () => {
  const server = fs.readFileSync(path.join(root, "src", "server.ts"), "utf8");
  const guard = server.slice(server.indexOf('app.use("/docs", (req, res, next)'), server.indexOf('app.use("/docs", express.static'));
  const pattern = guard.match(/if \((\/.+\/)\.test\(p\)\)/);
  assert.ok(pattern, "docs guard must use a path regex");
  const re = new Function(`return ${pattern![1]};`)() as RegExp;
  for (const blocked of ["/contracts/capability-parity.json", "/architecture/SOVEREIGN_PLATFORM.md", "/architecture"]) {
    assert.equal(re.test(blocked), true, blocked);
  }
  assert.equal(re.test("/README.md"), false);
});

/** HTML shells under public/docs are i18n templates; body copy lives in en/docs.json. */
const HTML_MD_MIRRORS: Array<{
  file: string;
  slug: string;
  mustInclude: string[];
  mustNotInclude: string[];
}> = [
  {
    file: "SECURITY_GUIDE",
    slug: "security-guide",
    mustInclude: ["/health", "/version", "/api/app/", "/api/auth/", "/live", "/ready", "Bearer"],
    mustNotInclude: ["All Forge API routes require authentication"],
  },
  {
    file: "API_REFERENCE",
    slug: "api-reference",
    mustInclude: ["LOCAL_SKIA_BACKEND_URL", "https://api.skia.ca", "Bearer JWT"],
    mustNotInclude: ["Proxied to `SKIA_BACKEND_URL`", "Proxied to <code>SKIA_BACKEND_URL</code>"],
  },
  {
    file: "TROUBLESHOOTING",
    slug: "troubleshooting",
    mustInclude: ["Bearer JWT", "/live", "/ready"],
    mustNotInclude: ["proxied to **`SKIA_BACKEND_URL`**", "Proxied to <code>SKIA_BACKEND_URL</code>"],
  },
  {
    file: "OPERATOR_MANUAL",
    slug: "operator-manual",
    mustInclude: ["4173", "Bearer JWT", "/embed"],
    mustNotInclude: ["SKIA_FULL_ALLOW_LOCAL_FALLBACK", "Embedding storage path"],
  },
  {
    file: "DEVELOPER_GUIDE",
    slug: "developer-guide",
    mustInclude: ["20.18.0", "/platform-downloads", "JWT_SECRET"],
    mustNotInclude: ["https://forge.skia.ca/platform-downloads"],
  },
];

function pageHtmlBlob(slug: string): string {
  const locale = JSON.parse(fs.readFileSync(path.join(root, "public", "locales", "en", "docs.json"), "utf8")) as {
    pages?: Record<string, { sections?: Record<string, { html?: string }> }>;
  };
  const sections = locale.pages?.[slug]?.sections ?? {};
  return Object.values(sections)
    .map((s) => s.html ?? "")
    .join("\n");
}

test("every public/docs HTML shell has a matching docs/*.md source", () => {
  for (const name of fs.readdirSync(path.join(root, "public", "docs")).filter((n) => n.endsWith(".html"))) {
    const md = path.join(root, "docs", name.replace(/\.html$/, ".md"));
    assert.ok(fs.existsSync(md), `missing ${path.relative(root, md)} for public/docs/${name}`);
  }
});

test("public/docs HTML shells reference en/docs.json slugs that exist", () => {
  const locale = JSON.parse(fs.readFileSync(path.join(root, "public", "locales", "en", "docs.json"), "utf8")) as {
    pages?: Record<string, unknown>;
  };
  for (const name of fs.readdirSync(path.join(root, "public", "docs")).filter((n) => n.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, "public", "docs", name), "utf8");
    const slug = html.match(/data-forge-i18n-slug="([^"]+)"/)?.[1];
    assert.ok(slug, `${name} missing data-forge-i18n-slug`);
    assert.ok(locale.pages?.[slug!], `en/docs.json missing pages.${slug} for ${name}`);
  }
});

test("customer MD and en/docs.json (HTML body source) stay aligned on Batch F1 claims", () => {
  for (const doc of HTML_MD_MIRRORS) {
    const md = fs.readFileSync(path.join(root, "docs", `${doc.file}.md`), "utf8");
    const htmlBody = pageHtmlBlob(doc.slug);
    assert.ok(htmlBody.length > 0, `empty en/docs.json body for ${doc.slug}`);
    for (const needle of doc.mustInclude) {
      assert.ok(md.includes(needle), `${doc.file}.md missing ${needle}`);
      assert.ok(htmlBody.includes(needle), `en/docs.json pages.${doc.slug} missing ${needle}`);
    }
    for (const needle of doc.mustNotInclude) {
      assert.ok(!md.includes(needle), `${doc.file}.md still has ${needle}`);
      assert.ok(!htmlBody.includes(needle), `en/docs.json pages.${doc.slug} still has ${needle}`);
    }
  }
});
