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

import { getBackendUrl, getTimeout } from "./skiaConfig";
import {
    FORGE_PLAN_REQUIRED_MESSAGE,
    userHasForgePlanAccess,
    type ForgeAccessUser,
} from "./forgePlanAccess";

declare global {
    interface Window {
        __skiaAuthPanel?: { signOut: () => void };
    }
}

function showPlanRequiredMessage(overlay: HTMLElement, email: string): void {
    const card = overlay.querySelector(".skia-auth-card") as HTMLElement;
    if (!card) return;
    card.innerHTML = `
    <div style="text-align:center; padding: 32px 24px;">
      <img src="../assets/sidebar-logo.png"
           style="width:80px; margin-bottom:20px; opacity:0.9;"
           alt="SKIA Forge" />
      <h2 style="color:#d4af37; font-size:28px; font-weight: 400;
                 letter-spacing:0.08em; margin-bottom:12px;">
        FORGE IDE REQUIRES A PLAN
      </h2>
      <p style="color:#ffffff; font-size: 14px; font-weight:400;
                line-height:1.6; margin-bottom:8px;">
        Signed in as <strong style="color:#d4af37;">${email}</strong>
      </p>
      <p style="color:rgba(255,255,255,0.55); font-size: 14px; font-weight:400;
                line-height:1.6; margin-bottom:24px;">
        ${FORGE_PLAN_REQUIRED_MESSAGE}
      </p>
      <a href="https://skia.ca/settings"
         style="display:block; background:#1a1a1a; border:1px solid #d4af37;
                border-radius:6px; color:#d4af37; font-size:11px;
                font-weight: 400; letter-spacing:0.12em; text-transform:uppercase;
                padding:14px 22px; text-decoration:none; margin-bottom:12px;
                cursor:pointer;">
        UPGRADE YOUR PLAN
      </a>
      <button onclick="window.__skiaAuthPanel.signOut()"
              style="background:transparent; border:1px solid rgba(212,175,55,0.3);
                     border-radius:6px; color:#999999; font-size:11px;
                     font-weight: 400; letter-spacing:0.12em; text-transform:uppercase;
                     padding:10px 22px; cursor:pointer; width:100%;">
        SIGN OUT
      </button>
      <p style="color:rgba(255,255,255,0.55); font-size:12px; font-weight:400; margin-top:20px;">
        ONE ECOSYSTEM. ONE UNIVERSE. ALL SKIA.
      </p>
    </div>
  `;
}

type AuthUser = {
    email: string;
    name?: string;
    id?: number;
    subscriptionStatus?: string | null;
    subscriptionPlan?: string | null;
    plan?: string | null;
    unlimitedUntil?: string | null;
    accessExpiresAt?: string | null;
    enterprisePlan?: boolean;
    credits?: number;
};

const getApiOrigin = (): string => getBackendUrl().replace(/\/+$/, "");

const authFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const ms = Math.min(Math.max(getTimeout(), 3000), 15000);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        window.clearTimeout(timer);
    }
};

const hideOnboardingOverlay = (): void => {
    document.getElementById("skia-onboarding-overlay")?.remove();
};
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
        if (typeof payload.message === "string" && payload.message.trim()) {
            return payload.message;
        }
        const err = payload.error;
        if (typeof err === "string") {
            if (err === "FORGE_PLAN_REQUIRED") return FORGE_PLAN_REQUIRED_MESSAGE;
            return err;
        }
        if (err && typeof err === "object") {
            const msg = (err as Record<string, unknown>).message;
            if (typeof msg === "string") return msg;
        }
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
    const idRaw = candidate.id;
    const id =
        typeof idRaw === "number"
            ? idRaw
            : typeof idRaw === "string" && /^\d+$/.test(idRaw)
                ? Number(idRaw)
                : undefined;
    const subscriptionStatus =
        typeof candidate.subscriptionStatus === "string" || candidate.subscriptionStatus === null
            ? (candidate.subscriptionStatus as string | null)
            : undefined;
    const unlimitedUntil =
        candidate.unlimitedUntil === null || typeof candidate.unlimitedUntil === "string"
            ? (candidate.unlimitedUntil as string | null)
            : candidate.unlimitedUntil instanceof Date
                ? candidate.unlimitedUntil.toISOString()
                : undefined;
    const accessExpiresAt =
        candidate.accessExpiresAt === null || typeof candidate.accessExpiresAt === "string"
            ? (candidate.accessExpiresAt as string | null)
            : candidate.accessExpiresAt instanceof Date
                ? candidate.accessExpiresAt.toISOString()
                : undefined;
    const enterprisePlan =
        typeof candidate.enterprisePlan === "boolean" ? candidate.enterprisePlan : undefined;
    const credits = typeof candidate.credits === "number" ? candidate.credits : undefined;
    const subscriptionPlan =
        typeof candidate.subscriptionPlan === "string" || candidate.subscriptionPlan === null
            ? (candidate.subscriptionPlan as string | null)
            : undefined;
    const plan =
        typeof candidate.plan === "string" || candidate.plan === null
            ? (candidate.plan as string | null)
            : undefined;

    return {
        email,
        name,
        ...(id !== undefined ? { id } : {}),
        ...(subscriptionStatus !== undefined ? { subscriptionStatus } : {}),
        ...(subscriptionPlan !== undefined ? { subscriptionPlan } : {}),
        ...(plan !== undefined ? { plan } : {}),
        ...(unlimitedUntil !== undefined ? { unlimitedUntil } : {}),
        ...(accessExpiresAt !== undefined ? { accessExpiresAt } : {}),
        ...(enterprisePlan !== undefined ? { enterprisePlan } : {}),
        ...(credits !== undefined ? { credits } : {}),
    };
};

const hasEntitlementPayload = (user: AuthUser): boolean =>
    user.subscriptionStatus !== undefined ||
    user.subscriptionPlan !== undefined ||
    user.plan !== undefined ||
    user.enterprisePlan !== undefined;

const hydrateUserIfNeeded = async (user: AuthUser, token: string | null): Promise<AuthUser> => {
    if (typeof user.id !== "number") return user;
    if (hasEntitlementPayload(user)) return user;
    if (!token) return user;
    let sessionResp: Response;
    try {
        sessionResp = await fetch(`${getApiOrigin()}/api/auth/session`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "x-skia-client": "forge-desktop",
            },
        });
    } catch {
        return user;
    }
    if (!sessionResp.ok) return user;
    const sessionPayload = (await sessionResp.json()) as unknown;
    return extractUser(sessionPayload) ?? user;
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

const denyForgeAccess = (user: AuthUser): boolean => {
    showLoginOverlay();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) showPlanRequiredMessage(overlay as HTMLElement, user.email || "");
    clearAuth();
    return false;
};

const setAuthenticated = (user: AuthUser): boolean => {
    if (!userHasForgePlanAccess(user as ForgeAccessUser)) {
        return denyForgeAccess(user);
    }

    authenticated = true;
    cachedUser = user;
    localStorage.setItem(USER_EMAIL_KEY, user.email);
    removeOverlay();
    authReadyCallbacks.forEach((cb) => cb());
    window.dispatchEvent(new CustomEvent("skia-auth-ready", { detail: user }));
    return true;
};

/** Re-fetch session with forge-desktop client so login returns a Bearer JWT for forge.skia.ca. */
const refetchForgeDesktopSessionToken = async (): Promise<string | null> => {
    let response: Response;
    try {
        response = await fetch(`${getApiOrigin()}/api/auth/session`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "x-skia-client": "forge-desktop",
            },
        });
    } catch {
        return null;
    }
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    const token = extractTokenFromBody(payload);
    if (token) {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
};

/** Persist Bearer token when session has a user but localStorage is still empty, then complete auth. */
const finalizeAuthenticatedUser = async (
    user: AuthUser,
    sessionPayload?: unknown
): Promise<boolean> => {
    const bodyToken = extractTokenFromBody(sessionPayload);
    if (bodyToken) localStorage.setItem(SESSION_TOKEN_KEY, bodyToken);
    const cookieToken = await getTokenFromElectronCookies();
    if (cookieToken) localStorage.setItem(SESSION_TOKEN_KEY, cookieToken);
    if (!getStoredToken()) {
        await refetchForgeDesktopSessionToken();
    }
    return setAuthenticated(user);
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
    const response = await authFetch(`${getApiOrigin()}/api/auth/session`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-skia-client": "forge-desktop",
        },
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as unknown;
    const user = extractUser(payload);
    if (!user) return false;
    return finalizeAuthenticatedUser(user, payload);
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
        let user = extractUser(responsePayload) ?? { email, name: firstName };
        user = await hydrateUserIfNeeded(user, token);
        if (!(await finalizeAuthenticatedUser(user, responsePayload))) return;
        return;
    }

    // 3. Cookie-only fallback — httpOnly cookie sent automatically
    const sessionResp = await fetch(`${getApiOrigin()}/api/auth/session`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "x-skia-client": "forge-desktop",
        },
    });
    if (sessionResp.ok) {
        const sessionPayload = (await sessionResp.json()) as unknown;
        let user = extractUser(sessionPayload) ?? { email, name: firstName };
        const sessionTok =
            extractTokenFromBody(sessionPayload) ||
            (await getTokenFromElectronCookies()) ||
            localStorage.getItem(SESSION_TOKEN_KEY);
        user = await hydrateUserIfNeeded(user, sessionTok);
        if (!(await finalizeAuthenticatedUser(user, sessionPayload))) return;
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
    "background:#111111", "border:1px solid rgba(212,175,55,0.3)", "color:#ffffff",
    "font-size:14px", "font-weight:400", "outline:none", "font-family: inherit"
].join(";");

const btnStyle = [
    "width:100%", "padding:11px", "background:transparent",
    "border:1px solid #d4af37", "color:#d4af37", "cursor:pointer",
    "letter-spacing:1.5px", "font-size:12px", "font-weight: 400", "font-family: inherit"
].join(";");

const showError = (id: string, message: string): void => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message;
    node.style.display = "block";
};

const showNotice = (id: string, message: string): void => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message;
    node.style.color = "#d4af37";
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
        "font-family: \"Centaur\", \"Centaur MT\", serif;"
    ].join("");

    overlay.innerHTML = `
    <div class="skia-auth-card" style="width:100%;max-width:420px;background:#1a1a1a;border:1px solid rgba(212,175,55,0.3);padding:32px 28px;">

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <img src="assets/sidebar-logo.png" alt="SKIA"
             onerror="this.style.display='none'"
             style="width:32px;height:32px;" />
        <span style="letter-spacing:2px;color:#d4af37;font-size:28px;font-weight: 400;">SKIA FORGE</span>
      </div>

      <div style="display:flex;border-bottom:1px solid #2a2a2a;margin-bottom:20px;">
        <button id="auth-tab-login"
          style="flex:1;background:transparent;border:none;border-bottom:2px solid #d4af37;
                 color:#ffffff;padding:10px 0;cursor:pointer;letter-spacing:1px;font-size:12px;font-weight: 400;">LOGIN</button>
        <button id="auth-tab-register"
          style="flex:1;background:transparent;border:none;border-bottom:2px solid transparent;
                 color:#555;padding:10px 0;cursor:pointer;letter-spacing:1px;font-size:12px;">REGISTER</button>
      </div>

      <form id="auth-login-form" autocomplete="on">
        <input id="auth-email" type="email" placeholder="Email"
               autocomplete="email" style="${inputStyle}" />
        <input id="auth-password" type="password" placeholder="Password"
               autocomplete="current-password" style="${inputStyle}" />
        <label style="display:flex;align-items:center;gap:8px;margin:-2px 0 12px;color:rgba(255,255,255,0.55);font-size:12px;font-weight:400;">
          <input id="auth-remember" type="checkbox" checked />
          Remember credentials on this device
        </label>
        <button id="auth-login-btn" type="submit" style="${btnStyle}">SIGN IN</button>
        <div id="auth-login-error"
             style="display:none;color:#ff5c5c;margin-top:10px;font-size:12px;line-height:1.5;"></div>
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
             style="display:none;color:#ff5c5c;margin-top:10px;font-size:12px;line-height:1.5;"></div>
      </form>

      <div style="margin-top:20px;text-align:center;font-size:12px;font-weight:400;color:rgba(255,255,255,0.55);letter-spacing:0.5px;">
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
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay?.dataset.handlersWired === "1") {
        return;
    }
    if (overlay) overlay.dataset.handlersWired = "1";

    const loginTab = document.getElementById("auth-tab-login") as HTMLButtonElement | null;
    const registerTab = document.getElementById("auth-tab-register") as HTMLButtonElement | null;
    const loginForm = document.getElementById("auth-login-form") as HTMLFormElement | null;
    const registerForm = document.getElementById("auth-register-form") as HTMLFormElement | null;
    const loginBtn = document.getElementById("auth-login-btn") as HTMLButtonElement | null;
    const registerBtn = document.getElementById("auth-register-btn") as HTMLButtonElement | null;
    const rememberBox = document.getElementById("auth-remember") as HTMLInputElement | null;
    if (!loginTab || !registerTab || !loginForm || !registerForm) return;

    const setTab = (tab: "login" | "register"): void => {
        const isLogin = tab === "login";
        loginForm.style.display = isLogin ? "block" : "none";
        registerForm.style.display = isLogin ? "none" : "block";
        loginTab.style.color = isLogin ? "#ffffff" : "#999999";
        registerTab.style.color = isLogin ? "#999999" : "#ffffff";
        loginTab.style.borderBottom = isLogin ? "2px solid #d4af37" : "2px solid transparent";
        registerTab.style.borderBottom = isLogin ? "2px solid transparent" : "2px solid #d4af37";
    };

    loginTab.addEventListener("click", () => setTab("login"));
    registerTab.addEventListener("click", () => setTab("register"));

    void window.skiaElectron.getSavedCredentials()
        .then((saved) => {
            if (!saved) return;
            const emailInput = document.getElementById("auth-email") as HTMLInputElement | null;
            const passInput = document.getElementById("auth-password") as HTMLInputElement | null;
            if (emailInput && !emailInput.value) emailInput.value = saved.email;
            if (passInput && !passInput.value) passInput.value = saved.password;
            if (rememberBox) rememberBox.checked = true;
        })
        .catch(() => {
            // ignore unavailable secure storage
        });

    // ── Login ──
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearError("auth-login-error");
        const email = (document.getElementById("auth-email") as HTMLInputElement | null)?.value.trim() ?? "";
        const password = (document.getElementById("auth-password") as HTMLInputElement | null)?.value ?? "";
        if (!email || !password) return;
        if (loginBtn) setButtonLoading(loginBtn, true, "SIGN IN");
        try {
            await performLogin(email, password, Boolean(rememberBox?.checked));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Login failed. Check your credentials.";
            showError(
                "auth-login-error",
                message.includes("FORGE_PLAN_REQUIRED") || message.includes("requires a subscription plan")
                    ? FORGE_PLAN_REQUIRED_MESSAGE
                    : message,
            );
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
                    "Content-Type": "application/json",
                    "x-skia-client": "forge-desktop"
                },
                body: JSON.stringify({ email, password, firstName: firstName || undefined })
            });
            if (!response.ok) throw new Error(await extractError(response));
            const payload = (await response.json()) as unknown;
            if (rememberBox?.checked) {
                void window.skiaElectron.saveCredentials(email, password);
            }
            try {
                await acquireTokenAfterAuth(payload, email, firstName || undefined);
            } catch (authErr) {
                const message = authErr instanceof Error ? authErr.message : "";
                if (message.includes("Authentication succeeded but no session token could be retrieved")) {
                    showNotice("auth-register-error", "Account created. Please switch to LOGIN and sign in.");
                    setTab("login");
                    return;
                }
                throw authErr;
            }
        } catch (err) {
            showError("auth-register-error",
                err instanceof Error ? err.message : "Registration failed. Try a different email.");
        } finally {
            if (registerBtn) setButtonLoading(registerBtn, false, "CREATE ACCOUNT");
        }
    });
};

const mountAuthOverlay = (): void => {
    removeOverlay();
    hideOnboardingOverlay();
    const overlay = createOverlay();
    document.body.appendChild(overlay);
    wireOverlayHandlers();
    window.requestAnimationFrame(() => {
        (document.getElementById("auth-email") as HTMLInputElement | null)?.focus();
    });
};

/** Opens the login/register overlay (e.g. from Settings when disconnected). */
export const showLoginOverlay = (): void => {
    mountAuthOverlay();
};

export const hasActiveSession = (): boolean =>
    authenticated && Boolean(cachedUser?.email?.trim());

export const performLogin = async (
    email: string,
    password: string,
    remember: boolean
): Promise<void> => {
    const response = await authFetch(`${getApiOrigin()}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "x-skia-client": "forge-desktop",
        },
        body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error(await extractError(response));
    const payload = (await response.json()) as unknown;
    if (remember) {
        void window.skiaElectron.saveCredentials(email, password);
    } else {
        void window.skiaElectron.clearSavedCredentials();
    }
    await acquireTokenAfterAuth(payload, email);
};

const showLoginIfStillUnauthenticated = (): void => {
    if (!hasActiveSession()) showLoginOverlay();
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const initializeAuthPanel = (): void => {
    if (initialized) {
        if (!hasActiveSession()) showLoginOverlay();
        return;
    }
    initialized = true;

    const token = getStoredToken();
    if (!token) {
        // Token may not be cached yet in Electron, but cookie session can still be valid.
        void authFetch(`${getApiOrigin()}/api/auth/session`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "x-skia-client": "forge-desktop"
            }
        })
            .then(async (response) => {
                if (!response.ok) {
                    return;
                }
                const payload = (await response.json()) as unknown;
                let user = extractUser(payload);
                if (!user) {
                    return;
                }
                const bodyToken = extractTokenFromBody(payload);
                if (bodyToken) localStorage.setItem(SESSION_TOKEN_KEY, bodyToken);
                const cookieToken = await getTokenFromElectronCookies();
                if (cookieToken) localStorage.setItem(SESSION_TOKEN_KEY, cookieToken);
                const sessionTok =
                    bodyToken || cookieToken || localStorage.getItem(SESSION_TOKEN_KEY);
                user = await hydrateUserIfNeeded(user, sessionTok);
                void finalizeAuthenticatedUser(user, payload);
            })
            .catch(() => {
                /* offline or timeout */
            })
            .finally(showLoginIfStillUnauthenticated);
        return;
    }

    void verifySession(token)
        .then((valid) => {
            if (!valid) {
                clearAuth();
            }
        })
        .catch(() => {
            if (!authenticated) {
                clearAuth();
            }
        })
        .finally(showLoginIfStillUnauthenticated);
};

export const isAuthenticated = (): boolean => authenticated;

export const getAuthToken = (): string | null => {
    if (!authenticated) return null;
    return getStoredToken();
};

export const getLoggedInUser = (): AuthUser | null => cachedUser;

export const logout = (): void => {
    clearAuth();
    showLoginOverlay();
};

export const onAuthReady = (callback: () => void): void => {
    authReadyCallbacks.push(callback);
};

window.__skiaAuthPanel = {
    signOut: () => {
        localStorage.removeItem("skia_session_token");
        localStorage.removeItem("skia_user_email");
        location.reload();
    },
};
