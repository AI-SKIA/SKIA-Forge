(function () {
  var LOCALES = ['fr', 'en', 'zh', 'es', 'ar', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];
  var DEFAULT_LOCALE = 'fr';
  var FALLBACK_LOCALE = 'en';

  function isLocale(v) {
    return LOCALES.indexOf(v) >= 0;
  }

  /** First path segment after leading slash (matches forge locale middleware). */
  function getLocaleFromPath(path) {
    var seg = (path || '').split('/')[1] || '';
    return isLocale(seg) ? seg : null;
  }

  function readCookieLocale() {
    var m = document.cookie.match(/(?:^|; )skia-ui-locale=([^;]*)/);
    var v = m && m[1] ? decodeURIComponent(m[1]) : null;
    return isLocale(v) ? v : null;
  }

  function readStoredLocale() {
    try {
      var s = localStorage.getItem('skia-ui-locale');
      return isLocale(s) ? s : null;
    } catch (e) {
      return null;
    }
  }

  function persistUiLocale(locale) {
    try {
      localStorage.setItem('skia-ui-locale', locale);
    } catch (e) {
      /* ignore */
    }
    document.cookie = 'skia-ui-locale=' + locale + ';path=/;max-age=31536000;SameSite=Lax';
  }

  function resolveLocale() {
    var pathLocale = getLocaleFromPath(location.pathname);
    if (pathLocale) {
      return pathLocale;
    }
    return readCookieLocale() || readStoredLocale() || DEFAULT_LOCALE;
  }

  function slugifyTitle(title) {
    return String(title)
      .toLowerCase()
      .replace(/&amp;/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function resolvePageConfig() {
    var body = document.body;
    var page = body.getAttribute('data-forge-i18n-page');
    var slug = body.getAttribute('data-forge-i18n-slug');
    if (page) return { namespaces: page === 'docs' ? ['common', 'docs'] : ['common', page], docSlug: slug || null };
    var path = location.pathname.replace(/^\/(fr|en|zh|es|ar|pt|de|ja|ko|hi|tr|ru)(?=\/)/, '');
    if (path === '/platform-downloads' || path.endsWith('/platform-downloads')) {
      return { namespaces: ['common', 'platform-downloads'], docSlug: null };
    }
    if (path === '/resources') return { namespaces: ['common', 'resources'], docSlug: null };
    if (path === '/security') return { namespaces: ['common', 'security'], docSlug: null };
    if (path === '/contact') return { namespaces: ['common', 'contact'], docSlug: null };
    var docM = path.match(/\/docs\/([A-Z0-9_]+)\.html$/i);
    if (docM) {
      var map = {
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
      var fileSlug = map[docM[1].toUpperCase()] || docM[1].toLowerCase().replace(/_/g, '-');
      return { namespaces: ['common', 'docs'], docSlug: fileSlug };
    }
    return { namespaces: ['common'], docSlug: null };
  }

  function getByPath(tree, keyPath) {
    var parts = keyPath.split('.');
    var cur = tree;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : undefined;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    });
  }

  function loadNamespaces(locale, names) {
    var primary = Promise.all(names.map(function (ns) {
      return fetchJson('/locales/' + locale + '/' + ns + '.json').catch(function () {
        return {};
      });
    }));
    var fallback =
      locale === FALLBACK_LOCALE
        ? Promise.resolve([])
        : Promise.all(names.map(function (ns) {
            return fetchJson('/locales/' + FALLBACK_LOCALE + '/' + ns + '.json').catch(function () {
              return {};
            });
          }));
    return Promise.all([primary, fallback]).then(function (res) {
      var parts = res[0];
      var enParts = res[1];
      var merged = {};
      for (var i = 0; i < names.length; i++) {
        merged[names[i]] = deepMerge(enParts[i] || {}, parts[i] || {});
      }
      return merged;
    });
  }

  function deepMerge(base, over) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (var k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
        out[k] = deepMerge(out[k] || {}, over[k]);
      } else if (over[k] !== undefined) {
        out[k] = over[k];
      }
    }
    return out;
  }

  function translate(messages, key) {
    if (key.indexOf('common.') === 0) return getByPath(messages.common, key.slice(7));
    if (key.indexOf('platform-downloads.') === 0) {
      return getByPath(messages['platform-downloads'], key.slice('platform-downloads.'.length));
    }
    if (key.indexOf('resources.') === 0) return getByPath(messages.resources, key.slice(10));
    if (key.indexOf('security.') === 0) return getByPath(messages.security, key.slice(9));
    if (key.indexOf('contact.') === 0) return getByPath(messages.contact, key.slice(8));
    if (key.indexOf('docs.') === 0) return getByPath(messages.docs, key.slice(5));
    return undefined;
  }

  function applyMessages(messages) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      var val = translate(messages, key);
      if (val === undefined && FALLBACK_LOCALE !== resolveLocale()) {
        /* fallback loaded in merge */
      }
      if (val !== undefined) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (!key) return;
      var val = translate(messages, key);
      if (val !== undefined) el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      var val = translate(messages, key);
      if (val !== undefined) el.setAttribute('placeholder', val);
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      if (!key) return;
      var val = translate(messages, key);
      if (val !== undefined) el.setAttribute('aria-label', val);
    });

    document.querySelectorAll('option[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      var val = translate(messages, key);
      if (val !== undefined) el.textContent = val;
    });

    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      var t = translate(messages, titleEl.getAttribute('data-i18n'));
      if (t) document.title = t;
    }

    applyContactForm(messages);
  }

  function applyContactForm(messages) {
    if (!messages.contact || !messages.contact.form) return;
    var f = messages.contact.form;
    var btn = document.getElementById('submitBtn');
    if (btn && f.submit) btn.textContent = f.submit;
    window.__forgeContactI18n = {
      fillAll: f.fillAll,
      sending: f.sending,
      success: f.success,
      failedPrefix: f.failedPrefix,
      submit: f.submit,
    };
    var oldClick = btn && btn.onclick;
    if (btn && !btn.__forgeI18nHooked) {
      btn.__forgeI18nHooked = true;
      var observer = new MutationObserver(function () {
        if (btn.textContent === 'Sending...' && f.sending) btn.textContent = f.sending;
      });
      observer.observe(btn, { childList: true, characterData: true, subtree: true });
    }
  }

  function run() {
    var pathLocale = getLocaleFromPath(location.pathname);
    if (pathLocale) {
      persistUiLocale(pathLocale);
    }
    var locale = resolveLocale();
    var cfg = resolvePageConfig();
    loadNamespaces(locale, cfg.namespaces)
      .then(function (messages) {
        applyMessages(messages);
      })
      .catch(function () {
        loadNamespaces(FALLBACK_LOCALE, cfg.namespaces).then(applyMessages);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
