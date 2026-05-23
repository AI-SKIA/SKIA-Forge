import { LOCALES } from './config.js';

/** Inline script for Forge HTML — runs before paint (URL → cookie → localStorage → fr). */
export function buildDocumentLocaleBootstrapScript(): string {
  const codes = JSON.stringify([...LOCALES]);
  return `(function(){var codes=${codes};var path=location.pathname||"";var seg=path.split("/").filter(Boolean)[0]||"";var fromPath=codes.indexOf(seg)>=0?seg:null;var m=document.cookie.match(/skia-ui-locale=([^;]+)/);var cookie=m?decodeURIComponent(m[1]):null;var stored=null;try{stored=localStorage.getItem("skia-ui-locale")}catch(e){}var locale=fromPath||(cookie&&codes.indexOf(cookie)>=0?cookie:null)||(stored&&codes.indexOf(stored)>=0?stored:null)||"fr";if(codes.indexOf(locale)<0)locale="fr";var rtl=locale==="ar";document.documentElement.lang=locale;document.documentElement.dir=rtl?"rtl":"ltr";})();`;
}
