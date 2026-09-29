import type { TranslationKey } from "./i18n/es";
import type { NavigationView } from "../types";

/**
 * Los tutoriales de cada pantalla. Uno por vista, que salta al entrar en ella con los
 * pasos que se pueden enseñar y aún no se han visto (ver ProductTour): quien nunca abre
 * Trades nunca ve el de Trades.
 *
 * **Lo visto se recuerda paso a paso** (ver useTourState). Un paso cuya zona aún no existe
 * —la tarjeta de una cuenta en una cuenta nueva— no sale, y sale solo, él solo, el día que
 * la zona aparece. Por lo mismo, **el `id` de un paso no se renombra**: para quien ya lo
 * vio contaría como nuevo y le volvería a salir. Y un paso añadido más adelante le sale
 * únicamente a quien ya había visto el resto: sirve para anunciar una novedad en su sitio.
 *
 * El criterio lo fijo el usuario y conviene mantenerlo: **claro y corto**. De 2 a 6 pasos
 * por pantalla, un titulo de dos o tres palabras y una o dos frases. Si un paso necesita
 * un parrafo, sobra el paso o sobra el parrafo.
 *
 * Cada paso señala un elemento por su atributo `data-tour`, no por su clase: las clases
 * cambian con el diseño y un tutorial que apunta a una clase renombrada no avisa, se
 * queda señalando a la nada. Si un elemento no esta en pantalla —una cuenta nueva no
 * tiene tarjetas, un widget del Journal puede estar oculto— ese paso se salta solo.
 */

export type TourStep = {
  id: string;
  /** Valor de `data-tour` del elemento que se resalta. Sin él, el paso va centrado. */
  target?: string;
  /** En movil (820px o menos) el menu lateral es un cajon cerrado: se señala otra cosa. */
  mobileTarget?: string;
  title: TranslationKey;
  body: TranslationKey;
};

export const tours: Record<NavigationView, TourStep[]> = {
  /* Es donde aterriza todo el mundo, asi que ademas de la pantalla enseña lo que es de
     toda la app: el menu, el boton de crear y dónde volver a ver esto. */
  overview: [
    { id: "welcome", title: "tour.overview.welcome.title", body: "tour.overview.welcome.body" },
    { id: "nav", target: "nav", mobileTarget: "nav-trigger", title: "tour.overview.nav.title", body: "tour.overview.nav.body" },
    { id: "primary", target: "primary-action", title: "tour.overview.primary.title", body: "tour.overview.primary.body" },
    { id: "metrics", target: "dashboard-metrics", title: "tour.overview.metrics.title", body: "tour.overview.metrics.body" },
    { id: "tax", target: "tax-summary", title: "tour.overview.tax.title", body: "tour.overview.tax.body" },
    { id: "menu", target: "topbar-menu", title: "tour.overview.menu.title", body: "tour.overview.menu.body" },
  ],
  firms: [
    { id: "primary", target: "primary-action", title: "tour.firms.primary.title", body: "tour.firms.primary.body" },
    { id: "overview", target: "firms-overview", title: "tour.firms.overview.title", body: "tour.firms.overview.body" },
    { id: "card", target: "firm-card", title: "tour.firms.card.title", body: "tour.firms.card.body" },
  ],
  accounts: [
    { id: "primary", target: "primary-action", title: "tour.accounts.primary.title", body: "tour.accounts.primary.body" },
    { id: "overview", target: "accounts-overview", title: "tour.accounts.overview.title", body: "tour.accounts.overview.body" },
    { id: "card", target: "account-card", title: "tour.accounts.card.title", body: "tour.accounts.card.body" },
    /* Añadido el 29 de septiembre de 2026, después de publicar los tutoriales: quien ya
       había visto el de Cuentas ve solo este paso. */
    { id: "details", target: "account-details", title: "tour.accounts.details.title", body: "tour.accounts.details.body" },
  ],
  movements: [
    { id: "primary", target: "primary-action", title: "tour.movements.primary.title", body: "tour.movements.primary.body" },
    { id: "import", target: "movements-import", title: "tour.movements.import.title", body: "tour.movements.import.body" },
    { id: "table", target: "movements-table", title: "tour.movements.table.title", body: "tour.movements.table.body" },
  ],
  journalDashboard: [
    { id: "primary", target: "primary-action", title: "tour.journalDashboard.primary.title", body: "tour.journalDashboard.primary.body" },
    { id: "account", target: "journal-account", title: "tour.journalDashboard.account.title", body: "tour.journalDashboard.account.body" },
    { id: "kpis", target: "journal-widget-kpis", title: "tour.journalDashboard.kpis.title", body: "tour.journalDashboard.kpis.body" },
    { id: "calendar", target: "journal-widget-calendar", title: "tour.journalDashboard.calendar.title", body: "tour.journalDashboard.calendar.body" },
    { id: "customize", target: "journal-customize", title: "tour.journalDashboard.customize.title", body: "tour.journalDashboard.customize.body" },
  ],
  journalEntries: [
    { id: "primary", target: "primary-action", title: "tour.journalEntries.primary.title", body: "tour.journalEntries.primary.body" },
    { id: "gallery", target: "journal-gallery", title: "tour.journalEntries.gallery.title", body: "tour.journalEntries.gallery.body" },
    { id: "filters", target: "journal-filters", title: "tour.journalEntries.filters.title", body: "tour.journalEntries.filters.body" },
  ],
  economicEvents: [
    { id: "nav", target: "events-nav", title: "tour.economicEvents.nav.title", body: "tour.economicEvents.nav.body" },
    { id: "settings", target: "events-settings", title: "tour.economicEvents.settings.title", body: "tour.economicEvents.settings.body" },
  ],
  settings: [
    { id: "profile", target: "settings-profile", title: "tour.settings.profile.title", body: "tour.settings.profile.body" },
    { id: "preferences", target: "settings-preferences", title: "tour.settings.preferences.title", body: "tour.settings.preferences.body" },
    { id: "data", target: "settings-data", title: "tour.settings.data.title", body: "tour.settings.data.body" },
  ],
};

/** Lo que se guarda como visto: "accounts.card". */
export function stepKey(view: NavigationView, step: TourStep) {
  return `${view}.${step.id}`;
}

/** El mismo corte que el cajon del menu (`@media (max-width: 820px)` en styles.css). */
const MOBILE_QUERY = "(max-width: 820px)";

export function tourSelector(target: string) {
  return `[data-tour="${target}"]`;
}

/** El `data-tour` que toca según el ancho, o undefined si el paso va centrado. */
export function stepTarget(step: TourStep) {
  if (!step.target) return undefined;
  const mobile = typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
  return mobile && step.mobileTarget ? step.mobileTarget : step.target;
}

/** Existe y se ve: con tamaño, sin `display: none` en él ni en ningún ancestro. */
export function findTourTarget(target: string) {
  const element = document.querySelector<HTMLElement>(tourSelector(target));
  if (!element || !element.getClientRects().length) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return getComputedStyle(element).visibility === "hidden" ? null : element;
}

/**
 * Los pasos que se pueden enseñar ahora mismo. Se decide una vez, al arrancar, para que
 * el "2 de 4" no cambie a mitad del recorrido.
 */
export function resolveTourSteps(view: NavigationView) {
  return tours[view].filter((step) => {
    const target = stepTarget(step);
    return !target || Boolean(findTourTarget(target));
  });
}
