import { Settings, Sparkles } from "lucide-react";
import { useT } from "../lib/i18n/context";
import type { useSubscription } from "../hooks/useSubscription";

type SubscriptionPanelProps = {
  onViewPlans: () => void;
  subscription: ReturnType<typeof useSubscription>;
};

export function SubscriptionPanel({ onViewPlans, subscription }: SubscriptionPanelProps) {
  const t = useT();
  const { accessActive, busy, canManageBilling, openBillingPortal, trialDaysLeft } = subscription;
  const status = subscription.subscription?.status;

  // undefined = el estado aun no se ha resuelto. Se muestra un placeholder en vez de
  // afirmar que no hay suscripcion, que seria falso y alarmante.
  if (subscription.subscription === undefined) {
    return (
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("subscription.title")}</h2>
            <p>{t("subscription.loading")}</p>
          </div>
        </div>
      </section>
    );
  }

  const { label, detail, tone } = describeSubscription({
    accessActive,
    currentPeriodEnd: subscription.subscription?.currentPeriodEnd ?? null,
    status,
    t,
    trialDaysLeft,
  });

  const showPlans = status !== "lifetime" && status !== "active";

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("subscription.title")}</h2>
          <p>{detail}</p>
        </div>
        <span className={`subscription-badge is-${tone}`}>{label}</span>
      </div>

      <div className="subscription-actions">
        {showPlans && (
          <button className="primary-action" onClick={onViewPlans} type="button">
            <Sparkles size={15} strokeWidth={2.2} />
            {t("subscription.viewPlans")}
          </button>
        )}
        {canManageBilling && (
          <button className="ghost-action" disabled={busy} onClick={() => void openBillingPortal()} type="button">
            <Settings size={15} strokeWidth={2.2} />
            {t("subscription.manage")}
          </button>
        )}
      </div>

      {subscription.error && (
        <p className="plans-error" role="status">
          {subscription.error}
        </p>
      )}
    </section>
  );
}

function describeSubscription({
  accessActive,
  currentPeriodEnd,
  status,
  t,
  trialDaysLeft,
}: {
  accessActive: boolean;
  currentPeriodEnd: string | null;
  status?: string;
  t: ReturnType<typeof useT>;
  trialDaysLeft: number;
}) {
  if (status === "lifetime") {
    return { label: t("subscription.status.lifetime"), detail: t("subscription.detail.lifetime"), tone: "positive" };
  }

  if (status === "active") {
    const renewal = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : "-";
    return {
      label: t("subscription.status.active"),
      detail: `${t("subscription.detail.renewsOn")} ${renewal}.`,
      tone: "positive",
    };
  }

  if (status === "past_due") {
    return { label: t("subscription.status.pastDue"), detail: t("subscription.detail.pastDue"), tone: "negative" };
  }

  if (status === "trialing" && accessActive) {
    const unit = trialDaysLeft === 1 ? t("subscription.trial.day") : t("subscription.trial.days");
    return {
      label: `${t("subscription.status.trial")}: ${trialDaysLeft} ${unit}`,
      detail: t("subscription.detail.trial"),
      tone: "neutral",
    };
  }

  return {
    label: t("subscription.status.inactive"),
    detail: status === "trialing" ? t("subscription.detail.trialEnded") : t("subscription.detail.inactive"),
    tone: "negative",
  };
}
