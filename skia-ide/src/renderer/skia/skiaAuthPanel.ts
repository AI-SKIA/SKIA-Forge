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

const readBearerToken = (init?: RequestInit): string | undefined => {
    if (!init?.headers) return undefined;
    if (init.headers instanceof Headers) {
        const raw = init.headers.get("Authorization");
        return raw?.replace(/^Bearer\s+/i, "").trim() || undefined;
    }
    const record = init.headers as Record<string, string>;
    const raw = record.Authorization ?? record.authorization;
    return raw?.replace(/^Bearer\s+/i, "").trim() || undefined;
};

/** Desktop IDE loads from file:// — browser fetch to api.skia.ca is blocked by CORS; use main-process bridge. */
const authFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    const method = ((init?.method || "GET").toUpperCase() === "POST" ? "POST" : "GET") as "GET" | "POST";
    let body: Record<string, unknown> | undefined;
    if (typeof init?.body === "string" && init.body.trim()) {
        try {
            body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
            body = undefined;
        }
    }

    if (window.skiaElectron?.authRequest) {
        const result = await window.skiaElectron.authRequest({
            path,
            method,
            body,
            bearerToken: readBearerToken(init),
        });
        return new Response(result.text, {
            status: result.status || (result.ok ? 200 : 500),
            headers: { "Content-Type": "application/json" },
        });
    }

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
            if (err === "AUTH_SERVICE_UNAVAILABLE") {
                return typeof payload.message === "string" && payload.message.trim()
                    ? payload.message
                    : "SKIA sign-in is temporarily unavailable. Try again shortly or sign in at skia.ca in your browser first.";
            }
            return err;
        }
        if (err && typeof err === "object") {
            const msg = (err as Record<string, unknown>).message;
            if (typeof msg === "string") return msg;
        }
    } catch { /* ignore */ }
    if (response.status === 503 || response.status === 502 || response.status === 504) {
        return "SKIA sign-in is temporarily unavailable (server busy or restarting). Wait a moment and try again.";
    }
    if (response.status === 401) {
        return "Invalid email or password. Use the same credentials as skia.ca.";
    }
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
        sessionResp = await authFetch(`${getApiOrigin()}/api/auth/session`, {
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
    const modalRoot = document.getElementById("skia-modal-root");
    if (modalRoot && modalRoot.childElementCount === 0) {
        modalRoot.setAttribute("aria-hidden", "true");
    }
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
        response = await authFetch(`${getApiOrigin()}/api/auth/session`, {
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
    const sessionResp = await authFetch(`${getApiOrigin()}/api/auth/session`, {
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

const getModalRoot = (): HTMLElement => {
    let root = document.getElementById("skia-modal-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "skia-modal-root";
        root.setAttribute("aria-hidden", "true");
        document.body.appendChild(root);
    }
    return root;
};

const createOverlay = (): HTMLDivElement => {
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Sign in to SKIA FORGE");

    overlay.innerHTML = `
    <div class="skia-auth-card">

      <div class="skia-auth-brand">
        <img src="assets/sidebar-logo.png" alt="SKIA"
             onerror="this.style.display='none'" />
        <span>SKIA FORGE</span>
      </div>

      <div class="skia-auth-tabs">
        <button id="auth-tab-login" type="button" class="skia-auth-tab is-active">LOGIN</button>
        <button id="auth-tab-register" type="button" class="skia-auth-tab">REGISTER</button>
      </div>

      <form id="auth-login-form" autocomplete="on">
        <input id="auth-email" type="email" placeholder="Email"
               autocomplete="email" class="skia-auth-input" />
        <input id="auth-password" type="password" placeholder="Password"
               autocomplete="current-password" class="skia-auth-input" />
        <label class="skia-auth-remember">
          <input id="auth-remember" type="checkbox" checked />
          Remember credentials on this device
        </label>
        <button id="auth-login-btn" type="submit" class="skia-auth-submit">SIGN IN</button>
        <div id="auth-login-error" class="skia-auth-error"></div>
      </form>

      <form id="auth-register-form" autocomplete="on" style="display:none;">
        <input id="auth-name" type="text" placeholder="First name (optional)"
               autocomplete="given-name" class="skia-auth-input" />
        <input id="auth-reg-email" type="email" placeholder="Email"
               autocomplete="email" class="skia-auth-input" />
        <input id="auth-reg-password" type="password" placeholder="Password"
               autocomplete="new-password" class="skia-auth-input" />
        <button id="auth-register-btn" type="submit" class="skia-auth-submit">CREATE ACCOUNT</button>
        <div id="auth-register-error" class="skia-auth-error"></div>
      </form>

      <div class="skia-auth-footer">
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
        loginTab.classList.toggle("is-active", isLogin);
        registerTab.classList.toggle("is-active", !isLogin);
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
            const response = await authFetch(`${getApiOrigin()}/api/auth/register`, {
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
    const modalRoot = getModalRoot();
    modalRoot.setAttribute("aria-hidden", "false");
    modalRoot.appendChild(overlay);
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
