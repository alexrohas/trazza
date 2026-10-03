import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { useT } from "../lib/i18n/context";
import { Wordmark } from "./Wordmark";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Lo que se pinta en lugar de `children` cuando fallan al pintarse. `null`: desaparecer
   *  sin decir nada, para lo que es opcional (el tutorial, el primer arranque). */
  fallback: ((error: Error) => ReactNode) | null;
  /** Al cambiar, el error se olvida y se vuelve a intentar pintar `children`. En App es la
   *  pantalla activa: si una falla, ir a otra desde el menú la deja atrás, y volver a ella
   *  la intenta de nuevo. */
  resetKey?: unknown;
};

type ErrorBoundaryState = { error: Error | null; resetKey: unknown };

/**
 * Sin esto, un error al pintar cualquier componente desmontaba la app entera y dejaba la
 * página en blanco, sin menú ni forma de salir salvo recargar a ciegas. React solo atrapa
 * esos errores con un componente de clase: no hay versión con hooks.
 *
 * Solo atrapa errores al pintar (y en los efectos). Los de un `onClick` o una promesa no
 * pasan por aquí, pero tampoco desmontan nada: la página sigue como estaba. React sigue
 * escribiendo el error en la consola, así que no se repite aquí.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: undefined };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  /* Se olvida el error en el mismo pintado en que cambia la clave, no en un efecto
     posterior: así no asoma un fotograma del aviso viejo sobre la pantalla nueva. */
  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState) {
    return Object.is(props.resetKey, state.resetKey) ? null : { error: null, resetKey: props.resetKey };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return this.props.fallback ? this.props.fallback(error) : null;
  }
}

/** Una pantalla ha fallado: ocupa su sitio, y el menú y la cabecera siguen funcionando. */
export function ViewErrorPanel({ error }: { error: Error }) {
  const t = useT();
  return (
    <article className="panel view-crash" role="alert">
      <CrashMessage error={error} text={t("app.crash.viewText")} title={t("app.crash.viewTitle")} />
    </article>
  );
}

/** Ha fallado lo que rodea a las pantallas (el armazón, el menú): no queda nada en pie
 *  desde lo que navegar, así que solo cabe recargar. */
export function AppErrorScreen({ error }: { error: Error }) {
  const t = useT();
  return (
    <main className="loading-screen" role="alert">
      <Wordmark />
      <CrashMessage error={error} text={t("app.crash.appText")} title={t("app.crash.appTitle")} />
    </main>
  );
}

/* Recargar es el único botón: vuelve a pedir los datos y el código, que es lo que arregla
   un fallo que se repite al pintar (un dato raro, o un despliegue nuevo que ya lo corrige).
   El mensaje técnico va plegado: no le dice nada a quien usa la app, pero es lo que hay que
   pedirle si escribe para contarlo. */
function CrashMessage({ error, text, title }: { error: Error; text: string; title: string }) {
  const t = useT();
  return (
    <div className="crash-message">
      <TriangleAlert size={22} strokeWidth={2.2} />
      <strong>{title}</strong>
      <p>{text}</p>
      <button className="primary-action" onClick={() => window.location.reload()} type="button">
        {t("app.crash.reload")}
      </button>
      <details>
        <summary>{t("app.crash.details")}</summary>
        <code>{error.message || error.name}</code>
      </details>
    </div>
  );
}
