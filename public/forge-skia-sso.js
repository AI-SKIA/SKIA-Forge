/**
 * When skia.ca links to Forge with ?skia_sso=1, exchange the shared SKIA session
 * for a Forge bearer token (stored in sessionStorage for /forge/platform).
 */
(function () {
  var TOKEN_KEY = 'skia_session_token';
  var ATTEMPT_KEY = 'forge_handoff_attempted';

  function readTokenFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    var sources = [params, hash];
    for (var s = 0; s < sources.length; s++) {
      var keys = ['token', 'accessToken', 'access_token', 'jwt'];
      for (var i = 0; i < keys.length; i++) {
        var value = sources[s].get(keys[i]);
        if (value && value.trim()) return value.trim();
      }
    }
    return null;
  }

  function scrubTokenFromUrl() {
    var url = new URL(window.location.href);
    var dirty = false;
    var keys = ['token', 'accessToken', 'access_token', 'jwt'];
    for (var i = 0; i < keys.length; i++) {
      if (url.searchParams.has(keys[i])) {
        url.searchParams.delete(keys[i]);
        dirty = true;
      }
    }
    if (url.hash) {
      var hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      for (var j = 0; j < keys.length; j++) {
        if (hash.has(keys[j])) {
          hash.delete(keys[j]);
          dirty = true;
        }
      }
      var next = hash.toString();
      url.hash = next ? '#' + next : '';
    }
    if (dirty) {
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }

  function persistToken(token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch (e) {}
  }

  function handoffReturnUrl() {
    var url = new URL(window.location.href);
    url.searchParams.delete('skia_sso');
    var keys = ['token', 'accessToken', 'access_token', 'jwt'];
    for (var i = 0; i < keys.length; i++) {
      url.searchParams.delete(keys[i]);
    }
    return url.origin + url.pathname + url.search;
  }

  var SKIA_FORGE_BRIDGE = 'https://skia.ca/api/auth/forge-bridge?returnTo=';

  function redirectToHandoff() {
    try {
      sessionStorage.setItem(ATTEMPT_KEY, '1');
    } catch (e) {}
    var returnTo = encodeURIComponent(handoffReturnUrl());
    window.location.replace(SKIA_FORGE_BRIDGE + returnTo);
  }

  var urlToken = readTokenFromUrl();
  if (urlToken) {
    persistToken(urlToken);
    scrubTokenFromUrl();
    return;
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get('skia_sso') !== '1') return;

  try {
    if (sessionStorage.getItem(TOKEN_KEY)) return;
    if (sessionStorage.getItem(ATTEMPT_KEY)) return;
  } catch (e) {}

  var fromSkia = false;
  try {
    fromSkia = (document.referrer || '').indexOf('skia.ca') !== -1;
  } catch (e2) {}

  if (fromSkia || params.get('skia_sso') === '1') {
    redirectToHandoff();
  }
})();
