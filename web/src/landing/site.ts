/* Lo que comparten las paginas publicas estaticas (la landing y la calculadora de Lucid):
 * tema, idioma, cabecera y analitica. Ninguna arrastra el bundle de React; cada una trae
 * su script y este modulo, que es lo unico que no tiene por que ser distinto entre ellas.
 *
 * Comparte con la app las dos claves de localStorage — "trazza:theme" y
 * "trazza:language" — a proposito: quien pone la pagina en ingles y en oscuro se
 * encuentra la app en ingles y en oscuro, sin volver a elegir.
 *
 * El castellano vive en el HTML y cada pagina pasa aqui solo su diccionario ingles. Asi
 * no hay dos copias del texto que puedan divergir, el contenido real viaja en el
 * documento (que es lo que lee Google) y la pagina no depende del script para tener
 * texto. La contrapartida es que una clave sin traducir no da error, solo se queda en
 * castellano — por eso el aviso en consola del final, que solo corre en desarrollo. */

import { inject } from "@vercel/analytics";

export type Language = "es" | "en";
type Theme = "light" | "dark";

const THEME_KEY = "trazza:theme";
const LANGUAGE_KEY = "trazza:language";

/* localStorage tira una excepcion (no devuelve null) en Safari con cookies bloqueadas y
   en cualquier navegador con el almacenamiento de sitio desactivado. Sin este envoltorio
   una configuracion de privacidad del visitante tumbaria el script entero. */
function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Sin almacenamiento la eleccion no sobrevive a la recarga, pero la sesion funciona. */
  }
}

const icons = {
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.99 13.18A9 9 0 1 1 10.82 3.01 7 7 0 0 0 20.99 13.18Z"/></svg>',
};

/**
 * Monta lo comun de una pagina publica y devuelve el idioma actual. `onLanguage` se
 * llama al arrancar y en cada cambio de idioma, despues de traducir el marcado: es donde
 * cada pagina repinta lo que no sale de data-i18n (el precio, los resultados).
 */
export function setUpSite(options: { en: Record<string, string>; name: string; onLanguage?: (language: Language) => void }) {
  const { en } = options;
  const spanishText = new Map<Element, string>();
  const spanishAria = new Map<Element, string>();

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    spanishText.set(node, node.textContent ?? "");
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    spanishAria.set(node, node.getAttribute("aria-label") ?? "");
  });

  let language: Language = readStore(LANGUAGE_KEY) === "en" ? "en" : "es";

  function applyLanguage(): void {
    document.documentElement.lang = language;

    spanishText.forEach((spanish, node) => {
      const key = node.getAttribute("data-i18n");
      if (!key) return;
      node.textContent = language === "en" ? (en[key] ?? spanish) : spanish;
    });

    spanishAria.forEach((spanish, node) => {
      const key = node.getAttribute("data-i18n-aria");
      if (!key) return;
      node.setAttribute("aria-label", language === "en" ? (en[key] ?? spanish) : spanish);
    });

    const label = document.querySelector("[data-language-label]");
    if (label) label.textContent = language.toUpperCase();

    options.onLanguage?.(language);
  }

  document.querySelector("[data-language-toggle]")?.addEventListener("click", () => {
    language = language === "es" ? "en" : "es";
    writeStore(LANGUAGE_KEY, language);
    applyLanguage();
  });

  /* ─── Tema ─── */

  const themeButton = document.querySelector("[data-theme-toggle]");

  function currentTheme(): Theme {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function paintThemeButton(): void {
    if (!themeButton) return;
    /* Mismo criterio que la app: el boton enseña el icono de a donde vas, no de donde
       estas. En oscuro se ve un sol porque pulsarlo te lleva al claro. */
    themeButton.innerHTML = currentTheme() === "dark" ? icons.sun : icons.moon;
  }

  themeButton?.addEventListener("click", () => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    writeStore(THEME_KEY, next);
    paintThemeButton();
  });

  /* ─── Cabecera ─── */

  const header = document.querySelector(".site-header");
  const paintHeader = () => header?.classList.toggle("is-stuck", window.scrollY > 8);
  window.addEventListener("scroll", paintHeader, { passive: true });

  applyLanguage();
  paintThemeButton();
  paintHeader();

  /* Analitica de Vercel. Va despues de pintar, porque no debe retrasar nada de lo
     visible: si fallara, la pagina ya esta montada.

     Sin cookies y sin identificadores persistentes, asi que no hace falta banner de
     consentimiento. El script se sirve desde el propio dominio
     (/_vercel/insights/script.js), no desde un tercero. En desarrollo se detecta solo y
     manda los eventos a un endpoint de depuracion, de modo que las visitas de trabajo no
     ensucian los datos reales. Y recoge los parametros utm_* de la URL, que es lo que
     permite separar que visita viene de cada red. */
  inject();

  if (import.meta.env.DEV) {
    const missing = [...spanishText.keys(), ...spanishAria.keys()]
      .map((node) => node.getAttribute("data-i18n") ?? node.getAttribute("data-i18n-aria"))
      .filter((key): key is string => Boolean(key) && !(key! in en));

    if (missing.length > 0) {
      console.warn(`[${options.name}] claves sin traducir al ingles: ${[...new Set(missing)].join(", ")}`);
    }
  }

  return { getLanguage: () => language };
}
