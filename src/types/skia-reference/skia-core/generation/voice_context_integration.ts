/**
 * voice_context_integration.ts
 *
 * Wires the SKIA voice identity system into the generation pipeline.
 * Loads the sovereign voice profile, merges per-request voice context,
 * and injects control tokens into prompts so every generation pass
 * is conditioned on SKIA's canonical voice identity.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VoiceContext {
    /** Which speaker profile to use (defaults to 'skia-sovereign-v1') */
    speakerId?: string;
    /** Stylistic modifiers e.g. ['calm', 'precise', 'warm'] */
    styleTags?: string[];
    /** Emotion signal [0–1] where 0=neutral, 1=peak expressive */
    emotionIntensity?: number;
    /** BCP-47 language tag e.g. 'en-CA', 'fr-FR' */
    language?: string;
    /** Explicit voice control tokens to inject (override auto-generation) */
    controlTokens?: string[];
}

export interface VoiceProfile {
    id: string;
    displayName?: string;
    defaultStyleTags?: string[];
    defaultLanguage?: string;
    forbiddenBehaviors?: string[];
    emotionRange?: { min: number; max: number };
    controlTokenPrefix?: string;
}

export interface VoiceInjectionResult {
    /** Final merged VoiceContext used for this generation */
    context: VoiceContext;
    /** Control token string to prepend to the generation prompt */
    promptPrefix: string;
    /** Whether the sovereign profile was applied */
    sovereignProfileActive: boolean;
    /** Any warnings (e.g. forbidden behavior attempted) */
    warnings: string[];
}

// ── Profile loader ────────────────────────────────────────────────────────────

const PROFILES_DIR = path.join(process.cwd(), 'skia-voice', 'profiles');
const SOVEREIGN_PROFILE_ID = 'skia-sovereign-v1';

let _profileCache: Map<string, VoiceProfile> = new Map();
let _profileCacheBuilt = false;

function loadProfiles(): Map<string, VoiceProfile> {
    if (_profileCacheBuilt) return _profileCache;
    _profileCache = new Map();

    try {
        if (!fs.existsSync(PROFILES_DIR)) {
            _profileCacheBuilt = true;
            return _profileCache;
        }
        for (const file of fs.readdirSync(PROFILES_DIR)) {
            if (!file.endsWith('.json')) continue;
            try {
                const raw = fs.readFileSync(path.join(PROFILES_DIR, file), 'utf-8').trim();
                if (!raw) continue;
                const profile: VoiceProfile = JSON.parse(raw);
                if (profile.id) _profileCache.set(profile.id, profile);
            } catch {
                // malformed profile — skip
            }
        }
    } catch {
        // profiles dir unreadable
    }

    // Ensure a minimal sovereign profile always exists as a fallback
    if (!_profileCache.has(SOVEREIGN_PROFILE_ID)) {
        _profileCache.set(SOVEREIGN_PROFILE_ID, {
            id: SOVEREIGN_PROFILE_ID,
            displayName: 'SKIA Sovereign',
            defaultStyleTags: ['calm', 'precise', 'authoritative', 'warm'],
            defaultLanguage: 'en-CA',
            forbiddenBehaviors: ['aggressive', 'dismissive', 'sycophantic'],
            emotionRange: { min: 0.1, max: 0.85 },
            controlTokenPrefix: '[VOICE:sovereign]',
        });
    }

    _profileCacheBuilt = true;
    return _profileCache;
}

export function invalidateProfileCache(): void {
    _profileCacheBuilt = false;
    _profileCache = new Map();
}

// ── Merge logic ───────────────────────────────────────────────────────────────

/**
 * Merges a base VoiceContext with an incoming override.
 * Arrays (styleTags, controlTokens) are union-merged; scalars are overridden.
 */
export function mergeVoiceContext(base: VoiceContext, incoming: VoiceContext): VoiceContext {
    const mergedStyleTags = Array.from(
        new Set([...(base.styleTags ?? []), ...(incoming.styleTags ?? [])])
    );
    const mergedControlTokens = Array.from(
        new Set([...(base.controlTokens ?? []), ...(incoming.controlTokens ?? [])])
    );

    return {
        speakerId: incoming.speakerId ?? base.speakerId,
        styleTags: mergedStyleTags,
        emotionIntensity:
            incoming.emotionIntensity !== undefined ? incoming.emotionIntensity : base.emotionIntensity,
        language: incoming.language ?? base.language,
        controlTokens: mergedControlTokens.length > 0 ? mergedControlTokens : undefined,
    };
}

// ── Control token builder ─────────────────────────────────────────────────────

function buildControlTokens(ctx: VoiceContext, profile: VoiceProfile): string[] {
    const tokens: string[] = [];

    // Profile prefix token
    if (profile.controlTokenPrefix) tokens.push(profile.controlTokenPrefix);

    // Language token
    const lang = ctx.language ?? profile.defaultLanguage ?? 'en';
    tokens.push(`[LANG:${lang}]`);

    // Style tag tokens
    const effectiveStyles = ctx.styleTags && ctx.styleTags.length > 0
        ? ctx.styleTags
        : (profile.defaultStyleTags ?? []);

    for (const tag of effectiveStyles) {
        tokens.push(`[STYLE:${tag}]`);
    }

    // Emotion intensity token (clamp to profile range)
    if (ctx.emotionIntensity !== undefined) {
        const range = profile.emotionRange ?? { min: 0, max: 1 };
        const clamped = Math.max(range.min, Math.min(range.max, ctx.emotionIntensity));
        tokens.push(`[EMOTION:${clamped.toFixed(2)}]`);
    }

    // Caller-supplied tokens appended last
    if (ctx.controlTokens) {
        for (const t of ctx.controlTokens) tokens.push(t);
    }

    return tokens;
}

// ── Main injection entry point ────────────────────────────────────────────────

/**
 * Resolves the voice profile, merges context, enforces forbidden behaviors,
 * and returns a prompt prefix + final context to use in generation.
 */
export function injectVoiceContext(incoming: VoiceContext = {}): VoiceInjectionResult {
    const profiles = loadProfiles();
    const warnings: string[] = [];

    // Resolve profile — fall back to sovereign if ID unknown
    const profileId = incoming.speakerId ?? SOVEREIGN_PROFILE_ID;
    const profile = profiles.get(profileId) ?? profiles.get(SOVEREIGN_PROFILE_ID)!;
    const sovereignProfileActive = profile.id === SOVEREIGN_PROFILE_ID;

    // Build base context from profile defaults
    const baseContext: VoiceContext = {
        speakerId: profile.id,
        styleTags: profile.defaultStyleTags ?? [],
        language: profile.defaultLanguage ?? 'en',
    };

    // Merge with incoming
    let ctx = mergeVoiceContext(baseContext, incoming);

    // Enforce forbidden behaviors — strip forbidden style tags, warn
    if (Array.isArray(profile.forbiddenBehaviors)) {
        const forbidden = new Set(profile.forbiddenBehaviors);
        const before = ctx.styleTags?.length ?? 0;
        ctx = {
            ...ctx,
            styleTags: (ctx.styleTags ?? []).filter((t) => !forbidden.has(t)),
        };
        const after = ctx.styleTags?.length ?? 0;
        if (after < before) {
            warnings.push(
                `Stripped ${before - after} forbidden style tag(s) per profile "${profile.id}" constraints.`
            );
        }
    }

    // Clamp emotion intensity to profile range
    if (ctx.emotionIntensity !== undefined && profile.emotionRange) {
        const { min, max } = profile.emotionRange;
        const clamped = Math.max(min, Math.min(max, ctx.emotionIntensity));
        if (clamped !== ctx.emotionIntensity) {
            warnings.push(`emotionIntensity clamped from ${ctx.emotionIntensity} to ${clamped} (profile range ${min}–${max})`);
            ctx = { ...ctx, emotionIntensity: clamped };
        }
    }

    // Build control token string
    const tokens = buildControlTokens(ctx, profile);
    const promptPrefix = tokens.join(' ');

    return {
        context: ctx,
        promptPrefix,
        sovereignProfileActive,
        warnings,
    };
}

/**
 * Utility: prepend the voice prompt prefix to an existing prompt string.
 * Use this at the final generation call site.
 */
export function applyVoicePrefix(prompt: string, incoming: VoiceContext = {}): string {
    const { promptPrefix } = injectVoiceContext(incoming);
    if (!promptPrefix) return prompt;
    return `${promptPrefix}\n\n${prompt}`;
}

/** Expose all loaded profiles (for Studio OS profile picker etc.) */
export function listVoiceProfiles(): VoiceProfile[] {
    return Array.from(loadProfiles().values());
}

/** Get a single profile by ID */
export function getVoiceProfile(id: string): VoiceProfile | undefined {
    return loadProfiles().get(id);
}