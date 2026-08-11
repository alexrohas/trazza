import { SlidersHorizontal } from "lucide-react";
import { useT } from "../lib/i18n/context";

type FilterToggleButtonProps = {
  active: boolean;
  isOpen: boolean;
  onClick: () => void;
};

export function FilterToggleButton({ active, isOpen, onClick }: FilterToggleButtonProps) {
  const t = useT();

  return (
    <button
      aria-expanded={isOpen}
      aria-label={t("common.filters")}
      className={`filter-toggle-button ${active ? "has-active-filters" : ""}`}
      onClick={onClick}
      type="button"
    >
      <SlidersHorizontal size={13} strokeWidth={2.2} />
      {active && <span className="filter-toggle-dot" aria-hidden="true" />}
    </button>
  );
}
