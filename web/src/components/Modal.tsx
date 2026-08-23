import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "../lib/i18n/context";

type ModalProps = {
  children: ReactNode;
  /** Oculta el titulo visualmente (sigue usandose como nombre accesible del dialogo)
   * para cuando el contenido ya lo repite justo debajo, como el simbolo y la fecha en
   * el detalle de una entrada de journal. */
  hideTitle?: boolean;
  onClose: () => void;
  subtitle?: string;
  title: string;
  width?: "default" | "wide";
};

export function Modal({ children, hideTitle = false, onClose, subtitle, title, width = "default" }: ModalProps) {
  const t = useT();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /**
   * Se monta en <body>, no donde se declara. Las vistas (.firms-workspace, .view-stack)
   * llevan animacion de entrada con transform, y un transform en un ancestro convierte
   * el contenedor de referencia de los position:fixed descendientes: .modal-layer dejaba
   * de medir la ventana y pasaba a medir toda la pagina, dejando el modal centrado a
   * mitad del scroll. Con el portal el modal cuelga del body y ningun ancestro puede
   * volver a romperlo.
   */
  return createPortal(
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" aria-label={t("common.closeModal")} onClick={onClose} type="button" />
      <section
        className={`modal-card ${width === "wide" ? "is-wide" : ""}`}
        aria-modal="true"
        role="dialog"
        aria-label={hideTitle ? title : undefined}
        aria-labelledby={hideTitle ? undefined : "modal-title"}
      >
        <header className="modal-header">
          {!hideTitle && (
            <div>
              <h2 id="modal-title">{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          )}
          <button className="icon-control compact-icon" onClick={onClose} type="button">
            <X size={17} strokeWidth={2.2} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
