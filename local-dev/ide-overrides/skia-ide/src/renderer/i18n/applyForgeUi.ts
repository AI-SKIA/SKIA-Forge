import { isLocale, LOCALE_LANGUAGE_OPTIONS } from './config';
import { getLocale, setLocale, t } from './forgeI18n';

const NAV_VIEW_KEYS: Record<string, string> = {
  explorer: 'nav.explorer',
  search: 'nav.search',
  agent: 'nav.agent',
  forge: 'nav.forge',
  settings: 'nav.settings',
  terminal: 'nav.terminal',
};

export function applyForgeUiStrings(): void {
  document.querySelectorAll<HTMLElement>('#skia-nav .nav-item').forEach((el) => {
    const view = el.dataset.view;
    if (view && NAV_VIEW_KEYS[view]) {
      el.textContent = t(NAV_VIEW_KEYS[view]);
    }
  });

  const explorerEmpty = document.getElementById('explorer-empty-state');
  if (explorerEmpty) {
    let hint = document.getElementById('explorer-open-folder-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.id = 'explorer-open-folder-hint';
      hint.style.cursor = 'pointer';
      hint.style.color = '#d4af37';
      hint.style.textDecoration = 'underline';
    }
    hint.textContent = t('explorer.openFolder');
    explorerEmpty.replaceChildren(
      document.createTextNode(`${t('explorer.noFolder')} `),
      hint,
      document.createTextNode(t('explorer.openFolderSuffix')),
    );
  }

  const viewHeaders: Array<[string, string]> = [
    ['view-search .view-header', 'views.search'],
    ['view-agent .view-header', 'views.agent'],
    ['view-forge .view-header', 'views.forge'],
    ['view-settings .view-header', 'settings.title'],
  ];
  for (const [sel, key] of viewHeaders) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) el.textContent = t(key);
  }

  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  if (searchInput) searchInput.placeholder = t('views.searchPlaceholder');

  const agentHint = document.querySelector<HTMLElement>('#view-agent .agent-hint');
  if (agentHint) agentHint.textContent = t('views.agentHint');

  const agentInput = document.getElementById('agent-task-input') as HTMLInputElement | null;
  if (agentInput) agentInput.placeholder = t('views.agentPlaceholder');

  const agentRun = document.getElementById('agent-run-btn');
  if (agentRun) agentRun.textContent = t('views.agentRun');
  const agentCancel = document.getElementById('agent-cancel-btn');
  if (agentCancel) agentCancel.textContent = t('views.agentCancel');

  applySettingsLabels();
  applyChatChromeStrings();
}

/** Setting value strings (not labels) — keep literal product/status copy. */
const SETTINGS_VALUE_I18N_KEYS = new Set(['settings.themeValue', 'settings.buildValue']);

function applySettingsLabels(): void {
  document.querySelectorAll<HTMLElement>('#view-settings [data-i18n]').forEach((el) => {
    const attr = el.getAttribute('data-i18n');
    if (!attr || SETTINGS_VALUE_I18N_KEYS.has(attr)) return;
    el.textContent = t(attr);
  });

  // Auth button label synced from index.ts (sign in vs sign out).
  const updatesBtn = document.getElementById('settings-check-updates-btn');
  if (updatesBtn && !updatesBtn.textContent?.includes('...')) {
    updatesBtn.textContent = t('settings.checkUpdates');
  }
  const docsBtn = document.getElementById('open-docs-btn');
  if (docsBtn) docsBtn.textContent = t('settings.openDocs');

  const tabSelect = document.getElementById('tab-size-select') as HTMLSelectElement | null;
  if (tabSelect?.options[0]) tabSelect.options[0].text = t('settings.tabSpaces2');
  if (tabSelect?.options[1]) tabSelect.options[1].text = t('settings.tabSpaces4');
}

export function applyChatChromeStrings(): void {
  const newChat = document.getElementById('chat-new-btn');
  if (newChat) newChat.textContent = t('chat.newChat');

  const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement | null;
  if (chatInput) chatInput.placeholder = t('chat.placeholder');

  const clearBtn = document.getElementById('chat-clear-btn');
  if (clearBtn) clearBtn.textContent = t('chat.clear');
  const cancelBtn = document.getElementById('chat-cancel-btn');
  if (cancelBtn) cancelBtn.textContent = t('chat.cancel');
  const sendBtn = document.getElementById('chat-send-btn');
  if (sendBtn) sendBtn.textContent = t('chat.send');

  const tagline = document.getElementById('chat-tagline');
  if (tagline) tagline.textContent = t('chat.tagline');

  const chatBrand = document.querySelector<HTMLElement>('.chat-brand span');
  if (chatBrand) chatBrand.textContent = t('chat.brand');

}

export function populateSettingsLocaleSelect(): void {
  const select = document.getElementById('settings-locale-select') as HTMLSelectElement | null;
  if (!select || select.options.length > 0) return;

  for (const opt of LOCALE_LANGUAGE_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt.code;
    o.textContent = opt.label;
    select.appendChild(o);
  }
  select.value = getLocale();
  select.addEventListener('change', () => {
    if (isLocale(select.value)) setLocale(select.value);
  });
}
