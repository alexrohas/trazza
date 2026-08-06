import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "../lib/i18n/context";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  subtitle?: string;
  title: string;
  width?: "default" | "wide";
};

export function Modal({ children, onClose, subtitle, title, width = "default" }: ModalProps) {
  const t = useT();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" aria-label={t("common.closeModal")} onClick={onClose} type="button" />
      <section className={`modal-card ${width === "wide" ? "is-wide" : ""}`} aria-modal="true" role="dialog" aria-labelledby="modal-title">
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-control compact-icon" onClick={onClose} type="button">
            <X size={17} strokeWidth={2.2} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
