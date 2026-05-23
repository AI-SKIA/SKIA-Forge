(function () {
  var codes = ['fr', 'en', 'zh', 'es', 'ar', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];
  var path = location.pathname || '';
  var fromPath = codes.indexOf(path.split('/')[1] || '') >= 0 ? path.split('/')[1] : null;
  var m = document.cookie.match(/skia-ui-locale=([^;]+)/);
  var cookie = m ? decodeURIComponent(m[1]) : null;
  var stored = null;
  try {
    stored = localStorage.getItem('skia-ui-locale');
  } catch (e) {
    /* ignore */
  }
  var locale =
    fromPath ||
    (cookie && codes.indexOf(cookie) >= 0 ? cookie : null) ||
    (stored && codes.indexOf(stored) >= 0 ? stored : null) ||
    'fr';
  if (codes.indexOf(locale) < 0) locale = 'fr';
  var rtl = locale === 'ar';
  document.documentElement.lang = locale;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
})();
