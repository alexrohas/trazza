/* Pagina legal (web/legal.html). Comparte con la landing cabecera, pie, tema y analitica
 * (setUpSite), pero no se traduce: el texto contractual vale en el idioma en que esta
 * redactado, y un diccionario ingles seria una segunda version del contrato que nadie ha
 * revisado. El unico trabajo propio de esta pagina es marcar en el indice la seccion que
 * se esta leyendo. */

import { setUpSite } from "../landing/site";

import "../landing/landing.css";
import "./legal.css";

setUpSite({
  en: {},
  name: "legal",
  /* setUpSite pone <html lang> segun el idioma guardado de la landing y la app. Aqui el
     contenido es siempre castellano, asi que se devuelve a "es": un lector de pantalla
     leeria el aviso legal con acento ingles si no. */
  onLanguage: () => {
    document.documentElement.lang = "es";
  },
});

const links = [...document.querySelectorAll<HTMLAnchorElement>(".legal-toc a")];
const sections = links
  .map((link) => document.getElementById(link.hash.slice(1)))
  .filter((section): section is HTMLElement => section !== null);

function markCurrent(id: string): void {
  for (const link of links) {
    if (link.hash === `#${id}`) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

/* La seccion actual es la ultima cuyo borde superior ya paso la linea de lectura (un tercio
   de la ventana, por debajo de la cabecera fija). Se calcula en cada scroll en vez de con un
   IntersectionObserver: las secciones miden de 150 a 1.800px, y con un observador por
   umbrales la corta del cookies (dos parrafos) se quedaba sin marcar o parpadeaba al pasar. */
function update(): void {
  const line = Math.max(140, window.innerHeight / 3);
  let current = sections[0];

  for (const section of sections) {
    if (section.getBoundingClientRect().top <= line) current = section;
  }

  /* Al final de la pagina la ultima seccion no llega a cruzar la linea si es corta (el
     disclaimer): se da por actual en cuanto no se puede bajar mas. */
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
    current = sections[sections.length - 1];
  }

  if (current) markCurrent(current.id);
}

/* Sin throttle con requestAnimationFrame: son cinco lecturas de rectangulo por evento, y un
   rAF pendiente en una pestaña oculta no se resuelve hasta volver a verla. */
window.addEventListener("scroll", update, { passive: true });
window.addEventListener("resize", update);
update();
