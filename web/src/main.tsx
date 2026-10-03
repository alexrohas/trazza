import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { ConfirmProvider } from "./components/confirm";
import { AppErrorScreen, ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./lib/i18n/context";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No se encontro el nodo root.");
}

/* La misma analitica que la landing, para poder ver el recorrido entero: cuanta gente
   llega a la pagina publica y cuanta acaba entrando en el producto. Va fuera de los
   proveedores porque no consume ninguno de sus contextos, y no pinta nada.

   La barrera de errores va dentro de I18nProvider para que su pantalla pueda traducirse
   (el proveedor solo lee una clave de localStorage, no tiene por donde fallar) y fuera de
   todo lo demas: es la red de ultimo recurso. La de cada pantalla esta en App.tsx. */
createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary fallback={(error) => <AppErrorScreen error={error} />}>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ErrorBoundary>
    </I18nProvider>
    <Analytics />
  </StrictMode>,
);
