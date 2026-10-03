// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../lib/i18n/context";
import { AppErrorScreen, ErrorBoundary, ViewErrorPanel } from "./ErrorBoundary";

/* Monta componentes de verdad con React en un DOM simulado (happy-dom, solo en este
   fichero): lo que se comprueba es lo que React hace con un error al pintar, y eso no se
   puede probar llamando a los métodos de la clase a mano. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  /* React escribe en la consola cada error que atrapa una barrera; aquí son a propósito. */
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

const render = (node: ReactNode) => act(() => root.render(node));

function Screen({ fail }: { fail: boolean }) {
  if (fail) throw new Error("Cannot read properties of undefined (reading 'name')");
  return <p>pantalla</p>;
}

const fallback = (error: Error) => <p role="alert">falló: {error.message}</p>;

describe("ErrorBoundary", () => {
  it("sin error pinta lo de dentro", () => {
    render(
      <ErrorBoundary fallback={fallback}>
        <Screen fail={false} />
      </ErrorBoundary>,
    );
    expect(container.textContent).toBe("pantalla");
  });

  it("un error al pintar se queda dentro: lo de fuera sigue en pie", () => {
    render(
      <>
        <nav>menú</nav>
        <ErrorBoundary fallback={fallback}>
          <Screen fail />
        </ErrorBoundary>
      </>,
    );
    expect(container.querySelector("nav")?.textContent).toBe("menú");
    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      "falló: Cannot read properties of undefined (reading 'name')",
    );
  });

  it("el error se mantiene hasta que cambia resetKey, y entonces vuelve a intentarlo", () => {
    render(
      <ErrorBoundary fallback={fallback} resetKey="accounts">
        <Screen fail />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain("falló");

    /* Mismo resetKey: aunque lo de dentro ya no fallara, el aviso sigue (no se reintenta
       solo en cada repintado, que con un fallo fijo sería un bucle). */
    render(
      <ErrorBoundary fallback={fallback} resetKey="accounts">
        <Screen fail={false} />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain("falló");

    /* Otra pantalla desde el menú: se olvida el error. */
    render(
      <ErrorBoundary fallback={fallback} resetKey="movements">
        <Screen fail={false} />
      </ErrorBoundary>,
    );
    expect(container.textContent).toBe("pantalla");
  });

  it("si la pantalla nueva también falla, vuelve a salir el aviso", () => {
    render(
      <ErrorBoundary fallback={fallback} resetKey="accounts">
        <Screen fail />
      </ErrorBoundary>,
    );
    render(
      <ErrorBoundary fallback={fallback} resetKey="movements">
        <Screen fail />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain("falló");
  });

  it("con fallback null desaparece sin llevarse lo de al lado", () => {
    render(
      <>
        <p>pantalla de debajo</p>
        <ErrorBoundary fallback={null}>
          <Screen fail />
        </ErrorBoundary>
      </>,
    );
    expect(container.textContent).toBe("pantalla de debajo");
  });

  it("atrapa también un valor que no es un Error", () => {
    function ThrowsString(): ReactNode {
      throw "texto suelto";
    }
    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowsString />
      </ErrorBoundary>,
    );
    expect(container.textContent).toBe("falló: texto suelto");
  });
});

describe("avisos", () => {
  const error = new Error("Cannot read properties of undefined (reading 'name')");

  it("el de una pantalla se traduce, enseña el error plegado y recarga", () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload });
    localStorage.setItem("trazza:language", "en");
    render(
      <I18nProvider>
        <ViewErrorPanel error={error} />
      </I18nProvider>,
    );

    expect(container.querySelector("strong")?.textContent).toBe("This screen ran into a problem");
    expect(container.querySelector("details code")?.textContent).toBe(error.message);
    expect(container.querySelector("details")?.open).toBe(false);

    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(reload).toHaveBeenCalledOnce();
  });

  it("el de la app entera va bajo el logo, en castellano por defecto", () => {
    render(
      <I18nProvider>
        <AppErrorScreen error={error} />
      </I18nProvider>,
    );
    expect(container.querySelector(".wordmark")?.textContent).toBe("trazza");
    expect(container.querySelector("strong")?.textContent).toBe("Algo ha fallado");
    expect(container.querySelector("button")?.textContent).toBe("Recargar la página");
  });
});
