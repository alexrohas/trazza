import { Check } from "lucide-react";
import { Modal } from "./Modal";
import { useT } from "../lib/i18n/context";
import type { BillingInterval } from "../hooks/useSubscription";

type PlansModalProps = {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (interval: BillingInterval) => void;
};

// Los precios no pasan por i18n a proposito: son importes fijos en euros, iguales en
// ambos idiomas. Solo se traduce el sufijo de periodo.
const MONTHLY_PRICE = "4,99€";
const ANNUAL_PRICE = "42€";

export function PlansModal({ busy, error, onClose, onSelect }: PlansModalProps) {
  const t = useT();

  const features = [t("plans.feature.unlimited"), t("plans.feature.journal"), t("plans.feature.cancel")];

  return (
    <Modal onClose={onClose} subtitle={t("plans.subtitle")} title={t("plans.title")} width="wide">
      <div className="plans-grid">
        <article className="plan-card">
          <span className="plan-name">{t("plans.monthly.name")}</span>
          <p className="plan-price">
            <strong>{MONTHLY_PRICE}</strong>
            <span>{t("plans.perMonth")}</span>
          </p>
          <ul className="plan-features">
            {features.map((feature) => (
              <li key={feature}>
                <Check size={15} strokeWidth={2.4} />
                {feature}
              </li>
            ))}
          </ul>
          <button className="secondary-action plan-cta" disabled={busy} onClick={() => onSelect("monthly")} type="button">
            {t("plans.cta.monthly")}
          </button>
        </article>

        <article className="plan-card is-featured">
          <span className="plan-badge">{t("plans.saveBadge")}</span>
          <span className="plan-name">{t("plans.annual.name")}</span>
          <p className="plan-price">
            <strong>{ANNUAL_PRICE}</strong>
            <span>{t("plans.perYear")}</span>
          </p>
          <ul className="plan-features">
            {features.map((feature) => (
              <li key={feature}>
                <Check size={15} strokeWidth={2.4} />
                {feature}
              </li>
            ))}
          </ul>
          <button className="primary-action plan-cta" disabled={busy} onClick={() => onSelect("annual")} type="button">
            {t("plans.cta.annual")}
          </button>
        </article>
      </div>

      {error && (
        <p className="plans-error" role="status">
          {error}
        </p>
      )}
    </Modal>
  );
}
