import { showForgeDownload } from './platformContext.js';

/** Server-rendered HTML: include link when desktop forge-web is assumed; client script hides on mobile / IDE. */
export function forgeDownloadAppLink(
  className: string,
  label = 'Download Skia Forge',
  href = '/api/app/download',
  i18nKey?: string,
): string {
  if (!showForgeDownload()) return '';
  const i18nAttr = i18nKey ? ` data-i18n="${i18nKey}"` : '';
  return `<a class="${className}" href="${href}" data-skia-forge-download${i18nAttr}>${label}</a>`;
}

/** Run in browser after static HTML loads — hides download CTAs on mobile UA and forge-ide. */
export function forgeDownloadClientGateScript(): string {
  return `<script>
(function(){
  function hide(){
    document.querySelectorAll('[data-skia-forge-download]').forEach(function(el){ el.remove(); });
  }
  var p=window.__SKIA_PLATFORM__;
  if(p==='forge-ide'||p==='mobile-browser'){ hide(); return; }
  if(!p&&/Android|iPhone|iPad|iPod|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent)){ hide(); }
})();
</script>`;
}
