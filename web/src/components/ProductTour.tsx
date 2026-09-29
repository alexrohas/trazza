import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findTourTarget, resolveTourSteps, stepKey, stepTarget, tourSelector, type TourStep } from "../lib/tours";
import { useT } from "../lib/i18n/context";
import type { TourState } from "../hooks/useTourState";
import type { NavigationView } from "../types";

/**
 * El tutorial de cada pantalla: oscurece todo menos la zona de la que se habla y pone al
 * lado una tarjeta con el texto, "Siguiente", "Anterior" y "Saltar".
 *
 * Salta al entrar en una pantalla si hay pasos que se puedan enseñar y aún no se hayan
 * visto, y enseña solo esos (nunca, si el usuario pidió "No mostrar más"). También vuelve
 * a mirar cuando cambian los datos: al crear la primera cuenta estando en Cuentas, sale
 * el paso de su tarjeta en cuanto se cierra el formulario. Desde el menú "⋯" se ve entero
 * el de la pantalla actual.
 *
 * Hecho a mano y no con una librería por lo mismo que Select o DatePicker: tiene que
 * hablar el lenguaje de la app (tokens, tema oscuro, el cajón del móvil) y no uno ajeno.
 */

type ProductTourProps = {
  view: NavigationView;
  /** Datos cargados: antes no hay nada que señalar. */
  ready: boolean;
  state: TourState;
  /** Cambia cuando cambian los datos (cuántas empresas, cuentas, movimientos...): es la
   *  señal para volver a mirar si ha aparecido la zona de algún paso pendiente. */
  contentKey: string;
  /** "Ver el tutorial de esta pantalla": salta entero aunque ya se haya visto o estén
   *  apagados. */
  request?: { id: number; view: NavigationView } | null;
  onRequestHandled: () => void;
  onSeen: (stepKeys: string[]) => void;
  onDisableAll: () => void;
};

/* Lo que puede estar encima de la pantalla. Con cualquiera abierto el tutorial espera: se
   pondría encima de un modal o de un desplegable y señalaría cosas tapadas. */
const BUSY_SELECTOR = [
  ".modal-layer",
  ".topbar-menu-panel",
  ".custom-select-panel",
  '.app-shell[data-mobile-nav="open"]',
].join(",");

/* Tras entrar en una pantalla (o cambiar los datos), cuánto se espera: las vistas entran
   con animación, y medir a mitad de ella daría la zona desplazada. Y cada cuánto se
   vuelve a mirar si sigue habiendo algo encima: sin límite, porque lo normal es que ese
   algo sea un formulario, que puede estar abierto un buen rato (el alta de varias cuentas
   que abre la importación del extracto, por ejemplo). Mirar un selector cada medio
   segundo no cuesta nada. */
const START_DELAY = 700;
const RETRY_EVERY = 500;

export function ProductTour({
  view,
  ready,
  state,
  contentKey,
  request,
  onRequestHandled,
  onSeen,
  onDisableAll,
}: ProductTourProps) {
  const [run, setRun] = useState<{ id: number; view: NavigationView; steps: TourStep[] } | null>(null);
  const runCount = useRef(0);
  const manual = Boolean(request && request.view === view);
  /* Si toca mirar. Qué pasos quedan por ver se decide al arrancar, contra lo que hay en
     pantalla en ese momento. */
  const due = manual || !state.disabled;

  /* Cambiar de pantalla con uno abierto (no debería poderse, la capa lo tapa todo, pero
     por si acaso): se cierra sin darlo por visto. Y una petición del menú que se quedó
     para otra pantalla se descarta: si no, saltaría más tarde, al volver a ella. */
  useEffect(() => {
    if (run && run.view !== view) setRun(null);
    if (request && request.view !== view) onRequestHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, view, request?.id]);

  useEffect(() => {
    /* Si ya hay uno abierto, la petición del menú está atendida: es lo que se está viendo.
       Sin esto se quedaba pendiente y, al cerrarlo, lo volvía a abrir desde el principio
       (pasó con una cuenta real: el automático salió tarde, con la pestaña oculta, y se
       cruzó con el del menú). */
    if (run) {
      if (manual) onRequestHandled();
      return;
    }
    if (!ready || !due) return;
    const seen = new Set(state.steps);
    let timer = window.setTimeout(function attempt() {
      if (document.querySelector(BUSY_SELECTOR)) {
        timer = window.setTimeout(attempt, RETRY_EVERY);
        return;
      }
      if (manual) onRequestHandled();
      /* A mano, entero. Solo, lo que falte por ver. */
      const steps = resolveTourSteps(view).filter((step) => manual || !seen.has(stepKey(view, step)));
      if (steps.length) {
        runCount.current += 1;
        setRun({ id: runCount.current, view, steps });
      }
    }, manual ? 150 : START_DELAY);
    return () => window.clearTimeout(timer);
    // request?.id: pedirlo dos veces seguidas en la misma pantalla lo vuelve a abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, run, due, view, request?.id, contentKey, state]);

  if (!run) return null;

  return (
    <TourOverlay
      key={run.id}
      onClose={(reason) => {
        if (reason === "disable") onDisableAll();
        /* Se dan por vistos los pasos que se han enseñado, también al saltar: "Saltar" es
           "no quiero esto ahora", no "enséñamelo la próxima vez". Los que no se enseñaron
           porque su zona aún no existía siguen pendientes. */
        onSeen(run.steps.map((step) => stepKey(run.view, step)));
        setRun(null);
      }}
      steps={run.steps}
    />
  );
}

type CloseReason = "done" | "skip" | "disable";

type Box = { top: number; left: number; width: number; height: number };

type Layout = {
  spot: Box;
  card: { top: number; left: number; width: number };
};

/* El hueco se separa un poco de la zona, y la tarjeta un poco del hueco y de los bordes. */
const SPOT_PAD = 6;
const CARD_GAP = 12;
const EDGE = 16;
const CARD_MAX_WIDTH = 360;
/* Por debajo de esto la tarjeta va a lo ancho, arriba o abajo, en vez de al lado. */
const NARROW = 560;
/* Lo que tarda el hueco en ir de una zona a la siguiente. */
const TRAVEL_MS = 380;

function round(box: Box): Box {
  return { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) };
}

function sameLayout(left: Layout | null, right: Layout) {
  if (!left) return false;
  const a = left.spot;
  const b = right.spot;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height &&
    left.card.top === right.card.top &&
    left.card.left === right.card.left &&
    left.card.width === right.card.width
  );
}

/** Un paso sin zona se dibuja como un hueco de tamaño cero en el centro: todo oscuro. */
function centerBox(width: number, height: number): Box {
  return { top: height / 2, left: width / 2, width: 0, height: 0 };
}

function placeCard(spot: Box, centered: boolean, cardHeight: number, vw: number, vh: number): Layout["card"] {
  const width = Math.min(CARD_MAX_WIDTH, vw - EDGE * 2);
  const clampLeft = (value: number) => Math.min(Math.max(value, EDGE), vw - EDGE - width);
  const clampTop = (value: number) => Math.min(Math.max(value, EDGE), vh - EDGE - cardHeight);

  if (centered) return { top: clampTop((vh - cardHeight) / 2), left: clampLeft((vw - width) / 2), width };

  /* Estrecho: a lo ancho, abajo. Arriba solo si la zona cabe entera por encima de ella (una
     zona pequeña en la mitad de abajo). Si no cabe entera en ningún lado —en un teléfono la
     barra de arriba ocupa 170px y muchas zonas son más altas que lo que queda—, abajo
     igualmente: lo que va arriba de una zona es su título y su primera fila, y es lo que
     hace falta ver. Tapar menos área no vale como regla: tapaba justo la cabecera. */
  if (vw <= NARROW) {
    const below = vh - EDGE - cardHeight;
    const fitsBelow = spot.top + spot.height + CARD_GAP <= below;
    const fitsAbove = spot.top - CARD_GAP >= EDGE + cardHeight;
    return { top: !fitsBelow && fitsAbove ? EDGE : below, left: EDGE, width: vw - EDGE * 2 };
  }

  const bottom = spot.top + spot.height;
  const right = spot.left + spot.width;
  const centeredLeft = clampLeft(spot.left + spot.width / 2 - width / 2);
  if (bottom + CARD_GAP + cardHeight <= vh - EDGE) return { top: bottom + CARD_GAP, left: centeredLeft, width };
  if (spot.top - CARD_GAP - cardHeight >= EDGE) return { top: spot.top - CARD_GAP - cardHeight, left: centeredLeft, width };
  if (right + CARD_GAP + width <= vw - EDGE) return { top: clampTop(spot.top), left: right + CARD_GAP, width };
  if (spot.left - CARD_GAP - width >= EDGE) return { top: clampTop(spot.top), left: spot.left - CARD_GAP - width, width };
  /* No cabe entera en ningún lado (una zona alta que la página no deja subir más): en el
     lado con más sitio, pisando lo mínimo. Y si no hay sitio en ninguno —la zona ocupa la
     pantalla entera—, en la esquina de abajo, que es lo que menos estorba al leerla. */
  const spaceBelow = vh - EDGE - bottom - CARD_GAP;
  const spaceAbove = spot.top - CARD_GAP - EDGE;
  if (Math.max(spaceBelow, spaceAbove) >= cardHeight / 2) {
    return spaceBelow >= spaceAbove
      ? { top: clampTop(bottom + CARD_GAP), left: centeredLeft, width }
      : { top: clampTop(spot.top - CARD_GAP - cardHeight), left: centeredLeft, width };
  }
  return { top: vh - EDGE - cardHeight, left: vw - EDGE - width, width };
}

/**
 * Cuánto tapa arriba la barra fija, o 0 si en realidad no se queda fija. Es `sticky` en
 * todos los anchos, pero en el móvil `.app-shell` lleva `overflow-x: hidden`, y eso hace
 * del armazón el contenedor del sticky: como el armazón no se desplaza (se desplaza la
 * ventana), la barra se va con la página. Fiarse de su `position` dejaba 170px vacíos
 * arriba en un teléfono. El body no cuenta: su overflow pasa a la ventana.
 */
function stickyTopbarHeight() {
  const topbar = document.querySelector<HTMLElement>(".topbar");
  if (!topbar || getComputedStyle(topbar).position !== "sticky") return 0;
  for (let node = topbar.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(node);
    if ([overflowX, overflowY].some((value) => value !== "visible" && value !== "clip")) return 0;
  }
  return topbar.offsetHeight;
}

/**
 * Trae la zona a la vista dejando sitio para la tarjeta, encima o debajo, para que no la
 * tape; y libre la barra de arriba, que es fija. Si zona y tarjeta no caben juntas (una
 * tabla larga), la zona se pega arriba y la tarjeta se pone donde pueda.
 */
function scrollIntoPlace(element: HTMLElement, cardHeight: number, reduceMotion: boolean) {
  const rect = element.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  /* Con la pestaña oculta el desplazamiento suave no avanza (va por fotogramas): ahí, de
     golpe. */
  const behavior: ScrollBehavior = reduceMotion || document.hidden ? "auto" : "smooth";
  /* La barra de arriba y la lateral son fijas: si ya se ven no hay nada que mover, y si
     no (la de arriba en un móvil desplazado), se vuelve arriba del todo. */
  if (element.closest(".sidebar, .topbar")) {
    if (rect.top < 0 || rect.bottom > vh) window.scrollTo({ top: 0, behavior });
    return;
  }
  const safeTop = stickyTopbarHeight() + EDGE;
  const safeBottom = vh - EDGE;
  const cardRoom = cardHeight + CARD_GAP;
  const cardWidth = Math.min(CARD_MAX_WIDTH, vw - EDGE * 2);
  const narrow = vw <= NARROW;
  /* En ancho la tarjeta también puede ir al lado; en estrecho va siempre abajo (o arriba). */
  const beside = !narrow && (vw - rect.right - CARD_GAP - EDGE >= cardWidth || rect.left - CARD_GAP - EDGE >= cardWidth);
  const visible = rect.top >= safeTop && rect.bottom <= safeBottom;
  const cardFits = narrow
    ? rect.bottom + cardRoom <= safeBottom
    : beside || rect.bottom + cardRoom <= safeBottom || rect.top - cardRoom >= safeTop;
  if (visible && cardFits) return;

  const room = safeBottom - safeTop;
  const needed = rect.height + (beside ? 0 : cardRoom);
  /* Cabe todo: el bloque zona + tarjeta, centrado (en estrecho, arriba, con la tarjeta
     abajo). No cabe: la zona arriba del todo. */
  const offset = needed <= room && !narrow ? (room - needed) / 2 : 0;
  window.scrollTo({ top: window.scrollY + rect.top - safeTop - offset, behavior });
}

function TourOverlay({ steps, onClose }: { steps: TourStep[]; onClose: (reason: CloseReason) => void }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [settled, setSettled] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const layoutRef = useRef<Layout | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= steps.length) {
        onClose("done");
        return;
      }
      setIndex(next);
    },
    [onClose, steps.length],
  );

  /* Cada fotograma se vuelve a medir la zona: así el hueco la sigue aunque la página se
     desplace, cambie de tamaño o la zona termine de animarse, sin tener que escuchar cada
     una de esas cosas por separado. Al cambiar de paso, el hueco viaja de la zona anterior
     a la nueva interpolando contra la posición que la nueva tiene EN ESE fotograma, así
     que llega bien aunque la página se esté desplazando a la vez. */
  useLayoutEffect(() => {
    const target = stepTarget(step);
    const from = layoutRef.current?.spot ?? centerBox(window.innerWidth, window.innerHeight);
    const started = performance.now();
    const travel = reduceMotion ? 0 : TRAVEL_MS;
    let stillFrames = 0;
    let lastTop = Number.NaN;
    let frame = 0;
    let timer = 0;
    /* Con la pestaña oculta el navegador no da fotogramas: ahí se sigue por tiempo, para que
       el tutorial esté ya colocado al volver (y para que se pueda probar sin tenerla delante). */
    const schedule = () => {
      if (document.hidden) timer = window.setTimeout(tick, 100);
      else frame = requestAnimationFrame(tick);
    };

    setSettled(false);
    const element = target ? findTourTarget(target) : null;
    if (element) scrollIntoPlace(element, cardRef.current?.offsetHeight || 240, reduceMotion);

    const tick = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const current = target ? document.querySelector<HTMLElement>(tourSelector(target)) : null;
      const rect = current?.getBoundingClientRect();
      const goal: Box = rect && rect.width > 0 ? {
        top: rect.top - SPOT_PAD,
        left: rect.left - SPOT_PAD,
        width: rect.width + SPOT_PAD * 2,
        height: rect.height + SPOT_PAD * 2,
      } : centerBox(vw, vh);
      const elapsed = performance.now() - started;
      const progress = travel ? Math.min(1, elapsed / travel) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      const spot = round({
        top: from.top + (goal.top - from.top) * eased,
        left: from.left + (goal.left - from.left) * eased,
        width: from.width + (goal.width - from.width) * eased,
        height: from.height + (goal.height - from.height) * eased,
      });
      const cardHeight = cardRef.current?.offsetHeight ?? 200;
      const next: Layout = { spot, card: placeCard(round(goal), !target || !rect, cardHeight, vw, vh) };
      if (!sameLayout(layoutRef.current, next)) {
        layoutRef.current = next;
        setLayout(next);
      }
      /* La tarjeta aparece cuando el hueco ha llegado y la zona lleva unos fotogramas
         quieta (el desplazamiento suave ha terminado): antes saltaría de sitio. */
      stillFrames = Math.abs(goal.top - lastTop) < 0.5 ? stillFrames + 1 : 0;
      lastTop = goal.top;
      if (progress === 1 && (stillFrames >= 3 || elapsed > 1200)) setSettled(true);
      schedule();
    };
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // Solo el paso: reduceMotion no cambia a mitad de un recorrido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* El foco va al botón principal en cada paso (sin desplazar nada) y vuelve donde
     estaba al cerrar. */
  useEffect(() => {
    if (settled) nextRef.current?.focus({ preventScroll: true });
  }, [settled, index]);

  /* Al cerrar, todo vuelve a como estaba: el foco a donde estaba y la página a la altura a
     la que estaba (el tutorial la habrá llevado hasta la última zona que enseñó). */
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollTop = window.scrollY;
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      const smooth = !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: scrollTop, behavior: smooth ? "smooth" : "auto" });
    };
  }, []);

  /* Teclado: Escape salta, las flechas avanzan y retroceden, y el tabulador no sale de la
     tarjeta. En fase de captura, para que nada de debajo reaccione a la misma tecla. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose("skip");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "Tab" && cardRef.current) {
        const focusable = [...cardRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
        if (!focusable.length) return;
        const first = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];
        const inside = cardRef.current.contains(document.activeElement);
        if (event.shiftKey && (document.activeElement === first || !inside)) {
          event.preventDefault();
          lastFocusable.focus();
        } else if (!event.shiftKey && (document.activeElement === lastFocusable || !inside)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [goTo, index, onClose]);

  const spot = layout?.spot;

  return createPortal(
    <div className="tour-layer">
      {/* Tapa la página entera: durante el tutorial no se puede pulsar nada de debajo. */}
      <div aria-hidden="true" className="tour-blocker" />
      <div
        aria-hidden="true"
        className={`tour-spotlight ${spot && spot.width > 1 ? "has-target" : ""}`}
        style={spot ? { top: spot.top, left: spot.left, width: spot.width, height: spot.height } : undefined}
      />
      <div
        aria-describedby="tour-body"
        aria-labelledby="tour-title"
        aria-modal="true"
        className={`tour-card ${settled ? "is-settled" : ""}`}
        ref={cardRef}
        role="dialog"
        style={layout ? { top: layout.card.top, left: layout.card.left, width: layout.card.width } : undefined}
      >
        <div className="tour-card-head">
          <span className="tour-progress">
            {steps.length > 1 &&
              t("tour.progress").replace("{n}", String(index + 1)).replace("{total}", String(steps.length))}
          </span>
          <button className="tour-link" onClick={() => onClose("skip")} type="button">
            {t("tour.skip")}
          </button>
        </div>
        <h2 id="tour-title">{t(step.title)}</h2>
        <p id="tour-body">{t(step.body)}</p>
        <div className="tour-actions">
          {index > 0 && (
            <button className="secondary-action" onClick={() => goTo(index - 1)} type="button">
              {t("tour.prev")}
            </button>
          )}
          <button className="primary-action" onClick={() => goTo(index + 1)} ref={nextRef} type="button">
            {last ? t("tour.done") : t("tour.next")}
          </button>
        </div>
        <button className="tour-link tour-disable" onClick={() => onClose("disable")} type="button">
          {t("tour.disableAll")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
