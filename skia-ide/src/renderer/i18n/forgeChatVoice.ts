import { getAuthToken } from '../skia/skiaAuthPanel';
import { getChatPipelineUrl } from '../skia/skiaConfig';
import {
  langToCountryAbbrev,
  pickVoiceForUiLocale,
  type VoiceLike,
} from './chatVoiceLocale';
import { getLocale, subscribeLocaleChange, t } from './forgeI18n';

export const VOICE_STORAGE_KEY = 'skia_selected_voice';

export type SkiaVoice = VoiceLike & { name: string; gender?: string };

const EMBEDDED_FEMALE_VOICES: SkiaVoice[] = [
  { id: 'en-US-female', name: 'Taylor', lang: 'en-US', gender: 'female' },
  { id: 'en-GB-female', name: 'Charlotte', lang: 'en-GB', gender: 'female' },
  { id: 'fr-FR-female', name: 'Chloé', lang: 'fr-FR', gender: 'female' },
  { id: 'es-ES-female', name: 'Lucía', lang: 'es-ES', gender: 'female' },
  { id: 'pt-BR-female', name: 'Ana Clara', lang: 'pt-BR', gender: 'female' },
  { id: 'de-DE-female', name: 'Lena', lang: 'de-DE', gender: 'female' },
  { id: 'it-IT-female', name: 'Alessia', lang: 'it-IT', gender: 'female' },
  { id: 'ar-SA-female', name: 'Reem', lang: 'ar-SA', gender: 'female' },
  { id: 'ja-JP-female', name: 'Miyu', lang: 'ja-JP', gender: 'female' },
  { id: 'zh-CN-female', name: 'Xiao Yu', lang: 'zh-CN', gender: 'female' },
  { id: 'ko-KR-female', name: 'Yuna', lang: 'ko-KR', gender: 'female' },
  { id: 'hi-IN-female', name: 'Priya', lang: 'hi-IN', gender: 'female' },
  { id: 'tr-TR-female', name: 'Zeynep', lang: 'tr-TR', gender: 'female' },
  { id: 'ru-RU-female', name: 'Svetlana', lang: 'ru-RU', gender: 'female' },
  { id: 'nl-NL-female', name: 'Sanne', lang: 'nl-NL', gender: 'female' },
];

let voices: SkiaVoice[] = [];
let selectedVoiceId = '';
let panelOpen = false;

function getVoicesApiUrl(): string {
  try {
    const chat = new URL(getChatPipelineUrl());
    return `${chat.origin}/api/voices`;
  } catch {
    return 'https://skia.ca/api/voices';
  }
}

function formatVoiceLabel(lang: string): string {
  try {
    const code = lang.split('-')[0] || 'en';
    const dn = new Intl.DisplayNames([code], { type: 'language' });
    const region = lang.split('-')[1];
    const langName = dn.of(code) || lang;
    if (!region) return langName;
    const rn = new Intl.DisplayNames(['en'], { type: 'region' });
    return `${langName} (${rn.of(region) || region})`;
  } catch {
    return lang;
  }
}

function readStoredVoiceId(): string {
  try {
    return localStorage.getItem(VOICE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function persistVoiceId(id: string): void {
  selectedVoiceId = id;
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function applyVoiceForUiLocale(): void {
  const match = pickVoiceForUiLocale(voices, getLocale());
  if (!match) return;
  persistVoiceId(match.id);
  refreshNationalityButton();
}

export function getSelectedVoiceLang(): string | undefined {
  const v = voices.find((x) => x.id === selectedVoiceId);
  return v?.lang;
}

export function getChatRequestLanguage(): string {
  const lang = getSelectedVoiceLang();
  if (lang) {
    const code = lang.split('-')[0]?.toLowerCase();
    if (code === 'fr' || code === 'es') return code;
    return 'en';
  }
  const ui = getLocale();
  if (ui === 'fr' || ui === 'es') return ui;
  return 'en';
}

function getSelectedVoice(): SkiaVoice | undefined {
  return voices.find((v) => v.id === selectedVoiceId);
}

function refreshNationalityButton(): void {
  const btn = document.getElementById('chat-nationality-btn');
  if (!btn) return;
  const voice = getSelectedVoice();
  const abbrev = langToCountryAbbrev(voice?.lang ?? 'en-US');
  btn.textContent = abbrev;
  const label = voice ? formatVoiceLabel(voice.lang) : 'English (United States)';
  btn.title = t('chat.nationalityTitle', { label });
}

function renderVoiceList(host: HTMLElement): void {
  host.innerHTML = '';
  for (const voice of voices) {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className =
      voice.id === selectedVoiceId
        ? 'voice-nationality-option voice-nationality-option--selected'
        : 'voice-nationality-option';
    opt.setAttribute('role', 'option');
    opt.setAttribute('aria-selected', String(voice.id === selectedVoiceId));
    opt.textContent = `${formatVoiceLabel(voice.lang)} — ${voice.name}`;
    opt.addEventListener('click', () => {
      persistVoiceId(voice.id);
      refreshNationalityButton();
      closeVoicePanel();
    });
    host.appendChild(opt);
  }
}

function closeVoicePanel(): void {
  panelOpen = false;
  const panel = document.getElementById('chat-voice-panel');
  if (panel) panel.style.display = 'none';
}

function openVoicePanel(): void {
  const panel = document.getElementById('chat-voice-panel');
  const list = document.getElementById('chat-voice-list');
  if (!panel || !list) return;
  renderVoiceList(list);
  panel.style.display = 'block';
  panelOpen = true;
}

async function loadVoices(): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(getVoicesApiUrl(), { headers, credentials: 'include' });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { voices?: SkiaVoice[] };
    voices = (data.voices ?? []).filter((v) => v.gender?.toLowerCase() === 'female');
  } catch {
    voices = [...EMBEDDED_FEMALE_VOICES];
  }

  selectedVoiceId = readStoredVoiceId();
  const existing = voices.find((v) => v.id === selectedVoiceId);
  if (!existing) {
    applyVoiceForUiLocale();
  } else {
    refreshNationalityButton();
  }
}

export function initializeForgeChatVoice(): void {
  const btn = document.getElementById('chat-nationality-btn');
  const closeBtn = document.getElementById('chat-voice-panel-close');
  const panel = document.getElementById('chat-voice-panel');

  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (panelOpen) closeVoicePanel();
    else openVoicePanel();
  });

  closeBtn?.addEventListener('click', () => closeVoicePanel());

  document.addEventListener('click', (e) => {
    if (!panelOpen || !panel) return;
    const target = e.target as Node;
    if (panel.contains(target) || btn?.contains(target)) return;
    closeVoicePanel();
  });

  subscribeLocaleChange(() => {
    applyVoiceForUiLocale();
    const header = document.querySelector<HTMLElement>(
      '#chat-voice-panel [data-i18n="chat.nationality"]',
    );
    if (header) header.textContent = t('chat.nationality');
    if (panelOpen) {
      const list = document.getElementById('chat-voice-list');
      if (list) renderVoiceList(list);
    }
  });

  void loadVoices();
}
