import { SlidersHorizontal } from "lucide-react";
import { useT } from "../lib/i18n/context";

type FilterToggleButtonProps = {
  active: boolean;
  isOpen: boolean;
  onClick: () => void;
  /** Para que un tutorial lo señale (ver lib/tours.ts). */
  tourId?: string;
};

export function FilterToggleButton({ active, isOpen, onClick, tourId }: FilterToggleButtonProps) {
  const t = useT();

  return (
    <button
      aria-expanded={isOpen}
      aria-label={t("common.filters")}
      className={`filter-toggle-button ${active ? "has-active-filters" : ""}`}
      data-tour={tourId}
      onClick={onClick}
      type="button"
    >
      <SlidersHorizontal size={13} strokeWidth={2.2} />
      {active && <span className="filter-toggle-dot" aria-hidden="true" />}
    </button>
  );
}
