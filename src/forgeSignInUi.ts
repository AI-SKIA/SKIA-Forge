/** Same-origin sign-in for forge.skia.ca web IDE (sets session cookies on the Forge host). */
export function renderForgeSignInHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKIA Forge | Sign in</title>
  <link rel="stylesheet" href="/forge-premium-ui.css" />
  <link rel="stylesheet" href="/forge-platform-console.css" />
</head>
<body class="forge-context-b forge-sign-in-shell">
  <div class="card">
    <h1>Sign in to Forge Web</h1>
    <p>Use your SKIA account. Your session stays on forge.skia.ca so the IDE can connect after sign-in.</p>
    <form id="signInForm" autocomplete="on">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit" id="submitBtn">Sign in</button>
      <div id="error" role="alert"></div>
    </form>
    <a class="link-btn" id="skiaCaLink" href="#">Sign in on skia.ca instead</a>
  </div>
  <script>
    const FORGE_SESSION_TOKEN_KEY = "skia_session_token";

    function localePrefix() {
      const match = window.location.pathname.match(/^\\/([a-z]{2})(\\/|$)/);
      return match ? "/" + match[1] : "";
    }

    function defaultReturnTo() {
      return window.location.origin + localePrefix() + "/forge/platform";
    }

    function resolveReturnTo() {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("returnTo");
      if (!raw) return defaultReturnTo();
      try {
        const url = new URL(raw, window.location.origin);
        if (url.origin !== window.location.origin) return defaultReturnTo();
        return url.href;
      } catch {
        return defaultReturnTo();
      }
    }

    function extractToken(payload) {
      if (!payload || typeof payload !== "object") return null;
      const root = payload;
      for (const key of ["token", "jwt", "accessToken", "access_token"]) {
        if (typeof root[key] === "string" && root[key].trim()) return root[key].trim();
      }
      const data = root.data;
      if (data && typeof data === "object") {
        for (const key of ["token", "jwt", "accessToken", "access_token"]) {
          if (typeof data[key] === "string" && data[key].trim()) return data[key].trim();
        }
      }
      return null;
    }

    function persistToken(token) {
      if (!token) return;
      try { sessionStorage.setItem(FORGE_SESSION_TOKEN_KEY, token); } catch {}
    }

    const returnTo = resolveReturnTo();
    const skiaCa = document.getElementById("skiaCaLink");
    if (skiaCa) {
      const prefix = localePrefix();
      skiaCa.href =
        "https://skia.ca" + prefix + "/login?returnTo=" + encodeURIComponent(returnTo);
    }

    document.getElementById("signInForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      const err = document.getElementById("error");
      const email = String(document.getElementById("email").value || "").trim();
      const password = String(document.getElementById("password").value || "");
      if (!email || !password) return;
      if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
      if (err) { err.style.display = "none"; err.textContent = ""; }
      try {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-skia-client": "forge-web"
          },
          body: JSON.stringify({ email, password })
        });
        if (!loginRes.ok) {
          let message = "Sign-in failed. Check your email and password.";
          try {
            const body = await loginRes.json();
            if (body && typeof body.error === "string") message = body.error;
            else if (body && typeof body.message === "string") message = body.message;
          } catch {}
          throw new Error(message);
        }
        const loginPayload = await loginRes.json();
        let token = extractToken(loginPayload);
        const sessionRes = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-skia-client": "forge-web",
            ...(token ? { Authorization: "Bearer " + token } : {})
          }
        });
        if (sessionRes.ok) {
          const sessionPayload = await sessionRes.json();
          token = extractToken(sessionPayload) || token;
        }
        if (!token) {
          throw new Error("Signed in but no session token was returned. Try again or contact support.");
        }
        persistToken(token);
        window.location.replace(returnTo);
      } catch (error) {
        if (err) {
          err.style.display = "block";
          err.textContent = error instanceof Error ? error.message : "Sign-in failed.";
        }
        if (btn) { btn.disabled = false; btn.textContent = "Sign in"; }
      }
    });
  </script>
</body>
</html>`;
}
