/**
 * skiaAuthPanel.ts
 *
 * Auth flow:
 *   1. POST /api/auth/login or /api/auth/register  (JSON body, credentials:"include")
 *      → server sets an httpOnly JWT cookie
 *      → response body may or may not contain a token field
 *   2. We ask the Electron main process to read that cookie via session.cookies API
 *      → stored in localStorage as skia_session_token for subsequent Bearer calls
 *   3. GET /api/auth/session with Authorization: Bearer <token>
 *      → used to verify an existing stored token on startup
 *
 * If the cookie bridge is unavailable, we fall back to extracting the token
 * from the JSON response body if present, then to a cookie-only session check.
 */

type AuthUser = { email: string; name?: string };

import { getBackendUrl } from "./skiaConfig";

const getApiOrigin = (): string => getBackendUrl().replace(/\/+$/, "");
const SESSION_TOKEN_KEY = "skia_session_token";
const USER_EMAIL_KEY = "skia_user_email";
const OVERLAY_ID = "skia-auth-overlay";

let authenticated = false;
let cachedUser: AuthUser | null = null;
let initialized = false;
const authReadyCallbacks: Array<() => void> = [];

// ─── Storage helpers ──────────────────────────────────────────────────────────

const getStoredToken = (): string | null => localStorage.getItem(SESSION_TOKEN_KEY);

// ─── Error / payload extraction ───────────────────────────────────────────────

const extractError = async (response: Response): Promise<string> => {
    try {
        const payload = (await response.json()) as Record<string, unknown>;
        const err = payload.error;
        if (typeof err === "string") return err;
        if (err && typeof err === "object") {
            const msg = (err as Record<string, unknown>).message;
            if (typeof msg === "string") return msg;
        }
        if (typeof payload.message === "string") return payload.message;
    } catch { /* ignore */ }
    return `Request failed (${response.status})`;
};

const extractTokenFromBody = (payload: unknown): string | null => {
    if (!payload || typeof payload !== "object") return null;
    const root = payload as Record<string, unknown>;
    for (const key of ["token", "jwt", "accessToken", "access_token"]) {
        if (typeof root[key] === "string" && (root[key] as string).trim()) {
            return root[key] as string;
        }
    }
    const data = root.data;
    if (data && typeof data === "object") {
        const nested = data as Record<string, unknown>;
        for (const key of ["token", "jwt", "accessToken", "access_token"]) {
            if (typeof nested[key] === "string" && (nested[key] as string).trim()) {
                return nested[key] as string;
            }
        }
    }
    return null;
};

const extractUser = (payload: unknown): AuthUser | null => {
    if (!payload || typeof payload !== "object") return null;
    const root = payload as Record<string, unknown>;
    const candidate = (root.user && typeof root.user === "object"
        ? root.user
        : root) as Record<string, unknown>;
    const email = typeof candidate.email === "string" ? candidate.email : "";
    if (!email) return null;
    const name =
        typeof candidate.firstName === "string" ? candidate.firstName :
            typeof candidate.name === "string" ? candidate.name : undefined;
    return { email, name };
};

// ─── Electron cookie bridge ───────────────────────────────────────────────────

const getTokenFromElectronCookies = async (): Promise<string | null> => {
    try {
        const electron = (window as unknown as {
            skiaElectron?: {
                getCookies?: (url: string) => Promise<Array<{ name: string; value: string }>>
            }
        }).skiaElectron;
        if (!electron?.getCookies) return null;
        const cookies = await electron.getCookies(getApiOrigin());
        for (const name of ["token", "jwt", "skia_token", "auth_token", "access_token", "session"]) {
            const found = cookies.find((c) => c.name === name);
            if (found?.value) return found.value;
        }
        // Any value that looks like a JWT (three base64url segments)
        const jwtLike = cookies.find((c) => /^[\w-]+\.[\w-]+\.[\w-]+$/.test(c.value));
        if (jwtLike) return jwtLike.value;
    } catch { /* bridge not available */ }
    return null;
};

// ─── Auth state management ────────────────────────────────────────────────────

const removeOverlay = (): void => {
    document.getElementById(OVERLAY_ID)?.remove();
};

const setAuthenticated = (user: AuthUser): void => {
    authenticated = true;
    cachedUser = user;
    localStorage.setItem(USER_EMAIL_KEY, user.email);
    removeOverlay();
    authReadyCallbacks.forEach((cb) => cb());
    window.dispatchEvent(new CustomEvent("skia-auth-ready", { detail: user }));
};

const clearAuth = (): void => {
    authenticated = false;
    cachedUser = null;
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    window.dispatchEvent(new CustomEvent("skia-auth-logout"));
};

// ─── Session verification ─────────────────────────────────────────────────────

const verifySession = async (token: string): Promise<boolean> => {
    const response = await fetch(`${getApiOrigin()}/api/auth/session`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        }
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as unknown;
    const user = extractUser(payload);
    if (!user) return false;
    setAuthenticated(user);
    return true;
};

// ─── Post-login token acquisition ─────────────────────────────────────────────

const acquireTokenAfterAuth = async (
    responsePayload: unknown,
    email: string,
    firstName?: string
): Promise<void> => {
    // 1. Try response body
    let token = extractTokenFromBody(responsePayload);

    // 2. Try Electron cookie bridge (give browser 150ms to process Set-Cookie)
    if (!token) {
        await new Promise((r) => setTimeout(r, 150));
        token = await getTokenFromElectronCookies();
    }

    if (token) {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
        const user = extractUser(responsePayload) ?? { email, name: firstName };
        setAuthenticated(user);
        return;
    }

    // 3. Cookie-only fallback — httpOnly cookie sent automatically
    const sessionResp = await fetch(`${getApiOrigin()}/api/auth/session`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (sessionResp.ok) {
        const sessionPayload = (await sessionResp.json()) as unknown;
        // Try cookie bridge one more time after session refresh
        const cookieToken = await getTokenFromElectronCookies();
        if (cookieToken) localStorage.setItem(SESSION_TOKEN_KEY, cookieToken);
        const user = extractUser(sessionPayload) ?? { email, name: firstName };
        setAuthenticated(user);
        return;
    }

    throw new Error(
        "Authentication succeeded but no session token could be retrieved. " +
        "Ensure ALLOW_LOCAL_DEV_COOKIES is set on the login service, or that the " +
        "login response returns a token field."
    );
};

// ─── Overlay UI ───────────────────────────────────────────────────────────────

const inputStyle = [
    "width:100%", "box-sizing:border-box", "margin-bottom:10px", "padding:11px 12px",
    "background:#101010", "border:1px solid #2a2a2a", "color:#e8d5a3",
    "font-size:14px", "outline:none", "font-family:inherit"
].join(";");

const btnStyle = [
    "width:100%", "padding:11px", "background:transparent",
    "border:1px solid #c9922a", "color:#c9922a", "cursor:pointer",
    "letter-spacing:1.5px", "font-size:13px", "font-family:inherit"
].join(";");

const showError = (id: string, message: string): void => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message;
    node.style.display = "block";
};

const clearError = (id: string): void => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = "";
    node.style.display = "none";
};

const setButtonLoading = (btn: HTMLButtonElement, loading: boolean, label: string): void => {
    btn.disabled = loading;
    btn.textContent = loading ? "Please wait..." : label;
    btn.style.opacity = loading ? "0.6" : "1";
};

const createOverlay = (): HTMLDivElement => {
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
        "position:fixed", "inset:0", "background:#0d0d0d", "z-index:9999",
        "display:flex", "align-items:center", "justify-content:center",
        "font-family:Segoe UI,sans-serif", "color:#e8d5a3"
    ].join(";");

    overlay.innerHTML = `
    <div style="width:100%;max-width:420px;background:#161616;border:1px solid #2a2a2a;padding:32px 28px;">

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <img src="assets/sidebar-logo.png" alt="SKIA"
             onerror="this.style.display='none'"
             style="width:32px;height:32px;" />
        <span style="letter-spacing:2px;color:#c9922a;font-size:16px;font-weight:600;">SKIA FORGE</span>
      </div>

      <div style="display:flex;border-bottom:1px solid #2a2a2a;margin-bottom:20px;">
        <button id="auth-tab-login"
          style="flex:1;background:transparent;border:none;border-bottom:2px solid #c9922a;
                 color:#e8d5a3;padding:10px 0;cursor:pointer;letter-spacing:1px;font-size:12px;">LOGIN</button>
        <button id="auth-tab-register"
          style="flex:1;background:transparent;border:none;border-bottom:2px solid transparent;
                 color:#555;padding:10px 0;cursor:pointer;letter-spacing:1px;font-size:12px;">REGISTER</button>
      </div>

      <form id="auth-login-form" autocomplete="on">
        <input id="auth-email" type="email" placeholder="Email"
               autocomplete="email" style="${inputStyle}" />
        <input id="auth-password" type="password" placeholder="Password"
               autocomplete="current-password" style="${inputStyle}" />
        <button id="auth-login-btn" type="submit" style="${btnStyle}">SIGN IN</button>
        <div id="auth-login-error"
             style="display:none;color:#ff9f9f;margin-top:10px;font-size:12px;line-height:1.5;"></div>
      </form>

      <form id="auth-register-form" autocomplete="on" style="display:none;">
        <input id="auth-name" type="text" placeholder="First name (optional)"
               autocomplete="given-name" style="${inputStyle}" />
        <input id="auth-reg-email" type="email" placeholder="Email"
               autocomplete="email" style="${inputStyle}" />
        <input id="auth-reg-password" type="password" placeholder="Password"
               autocomplete="new-password" style="${inputStyle}" />
        <button id="auth-register-btn" type="submit" style="${btnStyle}">CREATE ACCOUNT</button>
        <div id="auth-register-error"
             style="display:none;color:#ff9f9f;margin-top:10px;font-size:12px;line-height:1.5;"></div>
      </form>

      <div style="margin-top:20px;text-align:center;font-size:11px;color:#3a3a3a;letter-spacing:0.5px;">
        ONE ECOSYSTEM. ONE UNIVERSE. ALL SKIA.
      </div>
    </div>
  `;

    // Block Escape dismissal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.getElementById(OVERLAY_ID)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true);

    return overlay;
};

const wireOverlayHandlers = (): void => {
    const loginTab = document.getElementById("auth-tab-login") as HTMLButtonElement | null;
    const registerTab = document.getElementById("auth-tab-register") as HTMLButtonElement | null;
    const loginForm = document.getElementById("auth-login-form") as HTMLFormElement | null;
    const registerForm = document.getElementById("auth-register-form") as HTMLFormElement | null;
    const loginBtn = document.getElementById("auth-login-btn") as HTMLButtonElement | null;
    const registerBtn = document.getElementById("auth-register-btn") as HTMLButtonElement | null;
    if (!loginTab || !registerTab || !loginForm || !registerForm) return;

    const setTab = (tab: "login" | "register"): void => {
        const isLogin = tab === "login";
        loginForm.style.display = isLogin ? "block" : "none";
        registerForm.style.display = isLogin ? "none" : "block";
        loginTab.style.color = isLogin ? "#e8d5a3" : "#555";
        registerTab.style.color = isLogin ? "#555" : "#e8d5a3";
        loginTab.style.borderBottom = isLogin ? "2px solid #c9922a" : "2px solid transparent";
        registerTab.style.borderBottom = isLogin ? "2px solid transparent" : "2px solid #c9922a";
    };

    loginTab.addEventListener("click", () => setTab("login"));
    registerTab.addEventListener("click", () => setTab("register"));

    // ── Login ──
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearError("auth-login-error");
        const email = (document.getElementById("auth-email") as HTMLInputElement | null)?.value.trim() ?? "";
        const password = (document.getElementById("auth-password") as HTMLInputElement | null)?.value ?? "";
        if (!email || !password) return;
        if (loginBtn) setButtonLoading(loginBtn, true, "SIGN IN");
        try {
            const response = await fetch(`${getApiOrigin()}/api/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });
            if (!response.ok) throw new Error(await extractError(response));
            const payload = (await response.json()) as unknown;
            await acquireTokenAfterAuth(payload, email);
        } catch (err) {
            showError("auth-login-error",
                err instanceof Error ? err.message : "Login failed. Check your credentials.");
        } finally {
            if (loginBtn) setButtonLoading(loginBtn, false, "SIGN IN");
        }
    });

    // ── Register ──
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearError("auth-register-error");
        const firstName = (document.getElementById("auth-name") as HTMLInputElement | null)?.value.trim() ?? "";
        const email = (document.getElementById("auth-reg-email") as HTMLInputElement | null)?.value.trim() ?? "";
        const password = (document.getElementById("auth-reg-password") as HTMLInputElement | null)?.value ?? "";
        if (!email || !password) return;
        if (registerBtn) setButtonLoading(registerBtn, true, "CREATE ACCOUNT");
        try {
            const response = await fetch(`${getApiOrigin()}/api/auth/register`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password, firstName: firstName || undefined })
            });
            if (!response.ok) throw new Error(await extractError(response));
            const payload = (await response.json()) as unknown;
            await acquireTokenAfterAuth(payload, email, firstName || undefined);
        } catch (err) {
            showError("auth-register-error",
                err instanceof Error ? err.message : "Registration failed. Try a different email.");
        } finally {
            if (registerBtn) setButtonLoading(registerBtn, false, "CREATE ACCOUNT");
        }
    });
};

const ensureOverlay = (): void => {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = createOverlay();
    document.body.appendChild(overlay);
    wireOverlayHandlers();
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const initializeAuthPanel = (): void => {
    if (initialized) {
        if (!authenticated) ensureOverlay();
        return;
    }
    initialized = true;

    const token = getStoredToken();
    if (!token) {
        ensureOverlay();
        return;
    }

    void verifySession(token)
        .then((valid) => {
            if (!valid) { clearAuth(); ensureOverlay(); }
        })
        .catch(() => { clearAuth(); ensureOverlay(); });
};

export const isAuthenticated = (): boolean => authenticated;

export const getAuthToken = (): string | null => {
    if (!authenticated) return null;
    return getStoredToken();
};

export const getLoggedInUser = (): AuthUser | null => cachedUser;

export const logout = (): void => {
    clearAuth();
    ensureOverlay();
};

export const onAuthReady = (callback: () => void): void => {
    authReadyCallbacks.push(callback);
};