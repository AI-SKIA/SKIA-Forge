(function () {
  var LOCALES = ['fr', 'en', 'zh', 'es', 'ar', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];
  var LOCALE_OPTIONS = [
    { code: 'en', label: 'English', buttonCode: 'EN' },
    { code: 'fr', label: 'Français', buttonCode: 'FR' },
    { code: 'ar', label: 'العربية', buttonCode: 'AR' },
    { code: 'zh', label: '中文', buttonCode: '中文' },
    { code: 'es', label: 'Español', buttonCode: 'ES' },
    { code: 'de', label: 'Deutsch', buttonCode: 'DE' },
    { code: 'ja', label: '日本語', buttonCode: 'JA' },
    { code: 'ko', label: '한국어', buttonCode: 'KO' },
    { code: 'pt', label: 'Português', buttonCode: 'PT' },
    { code: 'hi', label: 'हिन्दी', buttonCode: 'HI' },
    { code: 'tr', label: 'Türkçe', buttonCode: 'TR' },
    { code: 'ru', label: 'Русский', buttonCode: 'RU' },
  ];

  function isLocale(value) {
    return LOCALES.indexOf(value) >= 0;
  }

  function getLocaleFromPath(path) {
    var segment = (path || '').split('/').filter(Boolean)[0] || '';
    return isLocale(segment) ? segment : null;
  }

  function stripLocalePrefix(path) {
    var locale = getLocaleFromPath(path);
    if (!locale) return path.indexOf('/') === 0 ? path : '/' + path;
    var without = path.replace(new RegExp('^/' + locale + '(?=/|$)'), '') || '/';
    return without.indexOf('/') === 0 ? without : '/' + without;
  }

  function withLocalePrefix(path, locale) {
    var base = stripLocalePrefix(path);
    if (base === '/') return '/' + locale;
    return '/' + locale + base;
  }

  function readCookieLocale() {
    var m = document.cookie.match(/(?:^|; )skia-ui-locale=([^;]*)/);
    var value = m && m[1] ? decodeURIComponent(m[1]) : null;
    return isLocale(value) ? value : null;
  }

  function readStoredLocale() {
    try {
      var stored = localStorage.getItem('skia-ui-locale');
      return isLocale(stored) ? stored : null;
    } catch (e) {
      return null;
    }
  }

  function resolveClientLocale() {
    return (
      getLocaleFromPath(location.pathname) ||
      readCookieLocale() ||
      readStoredLocale() ||
      'fr'
    );
  }

  function persistUiLocale(locale) {
    try {
      localStorage.setItem('skia-ui-locale', locale);
    } catch (e) {
      /* ignore */
    }
    document.cookie = 'skia-ui-locale=' + locale + ';path=/;max-age=31536000;SameSite=Lax';
  }

  function applyDocumentLocale(locale) {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }

  function localizeSidebarLinks(locale) {
    var nav = document.querySelector('#pcSidebar .pc-sidebar-nav');
    if (!nav) return;
    var links = nav.querySelectorAll('a[href^="/"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href');
      if (!href || href.indexOf('//') === 0) continue;
      if (href.indexOf('/api') === 0) continue;
      a.setAttribute('href', withLocalePrefix(href, locale));
    }
  }

  function mountLanguageSwitcher() {
    var sidebar = document.getElementById('pcSidebar');
    if (!sidebar) return;

    if (sidebar.querySelector('.pc-sidebar-locale')) return;

    var nav = sidebar.querySelector('.pc-sidebar-nav');
    if (!nav) return;

    var locale = resolveClientLocale();
    applyDocumentLocale(locale);
    localizeSidebarLinks(locale);

    var current =
      LOCALE_OPTIONS.filter(function (o) {
        return o.code === locale;
      })[0] || LOCALE_OPTIONS[0];

    var wrap = document.createElement('div');
    wrap.className = 'pc-sidebar-locale';
    wrap.innerHTML =
      '<div class="skia-lang-switcher skia-lang-switcher--compact">' +
      '<button type="button" class="skia-lang-switcher__trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="skia-lang-switcher__globe" aria-hidden="true">' +
      '<svg class="skia-lang-switcher__globe-svg" width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" stroke-width="1"/>' +
      '<ellipse cx="7.5" cy="7.5" rx="2.5" ry="6.5" stroke="currentColor" stroke-width="1"/>' +
      '<line x1="1" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="1"/>' +
      '<line x1="1" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1"/>' +
      '</svg></span>' +
      '<span class="skia-lang-switcher__code"></span>' +
      '<span class="skia-lang-switcher__caret" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="skia-lang-switcher__menu" role="listbox" hidden></div>' +
      '</div>';

    nav.insertAdjacentElement('beforebegin', wrap);

    var root = wrap.querySelector('.skia-lang-switcher');
    var trigger = wrap.querySelector('.skia-lang-switcher__trigger');
    var codeEl = wrap.querySelector('.skia-lang-switcher__code');
    var menu = wrap.querySelector('.skia-lang-switcher__menu');
    if (!root || !trigger || !codeEl || !menu) return;

    codeEl.textContent = current.buttonCode;
    trigger.setAttribute('aria-label', 'Language: ' + current.label);

    LOCALE_OPTIONS.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'skia-lang-switcher__option' +
        (opt.code === locale ? ' skia-lang-switcher__option--active' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(opt.code === locale));
      btn.textContent = opt.label;
      btn.addEventListener('click', function () {
        if (opt.code === locale) {
          closeMenu();
          return;
        }
        persistUiLocale(opt.code);
        applyDocumentLocale(opt.code);
        var target = withLocalePrefix(location.pathname + location.search, opt.code);
        window.location.assign(target);
      });
      menu.appendChild(btn);
    });

    function closeMenu() {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    document.addEventListener('mousedown', function (e) {
      if (!root.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountLanguageSwitcher);
  } else {
    mountLanguageSwitcher();
  }
})();
