import { AlertTriangle, Clock3, LockKeyhole } from "lucide-react";
import { useT } from "../lib/i18n/context";
import type { useSubscription } from "../hooks/useSubscription";

type SubscriptionNoticeProps = {
  onViewPlans: () => void;
  subscription: ReturnType<typeof useSubscription>;
};

/* Desde cuantos dias restantes se avisa de que la prueba se acaba. Tres da margen para
   reaccionar sin que el aviso viva puesto las dos semanas enteras, que es como pasa a
   ser parte del decorado y se deja de leer. */
const TRIAL_WARNING_DAYS = 3;

/**
 * Aviso sobre el contenido cuando la suscripcion pide atencion.
 *
 * Existe porque el paywall era invisible hasta que chocabas con el: `guard()` en App
 * abre el selector de planes al intentar guardar algo, asi que quien vuelve con la
 * prueba caducada, mira sus datos y se va, no llega a enterarse de que hay algo que
 * pagar ni de por que no puede editar. Aqui se dice antes de que lo intente.
 *
 * Cubre tambien el aviso previo: hasta ahora `trialDaysLeft` solo se veia entrando en
 * Ajustes, de modo que la prueba se acababa sin que nadie lo hubiera dicho.
 */
export function SubscriptionNotice({ onViewPlans, subscription }: SubscriptionNoticeProps) {
  const t = useT();
  const { accessActive, busy, canManageBilling, openBillingPortal, subscription: row, trialDaysLeft } = subscription;

  // undefined = sin resolver todavia; null = sin fila o fallo de carga. En los dos casos
  // `canMutateData` deja escribir (fail-open), asi que anunciar un bloqueo seria mentir.
  if (!row) return null;
  if (row.status === "lifetime" || row.status === "active") return null;

  const notice = describeNotice({ accessActive, canManageBilling, status: row.status, t, trialDaysLeft });
  if (!notice) return null;

  const Icon = notice.icon;

  return (
    <section className={`subscription-notice is-${notice.tone}`} role="status">
      <Icon size={19} strokeWidth={2.2} />
      <div>
        <strong>{notice.title}</strong>
        <p>{notice.text}</p>
      </div>
      <button
        className={`${notice.tone === "ending" ? "secondary-action" : "primary-action"} subscription-notice-cta`}
        disabled={busy}
        onClick={notice.usePortal ? () => void openBillingPortal() : onViewPlans}
        type="button"
      >
        {notice.cta}
      </button>
    </section>
  );
}

/* Mismo reparto que `describeSubscription` en SubscriptionPanel: la decision de que se
   dice vive en una funcion aparte y el componente solo pinta. Devuelve null cuando no
   hay nada que avisar, que es el caso normal. */
function describeNotice({
  accessActive,
  canManageBilling,
  status,
  t,
  trialDaysLeft,
}: {
  accessActive: boolean;
  canManageBilling: boolean;
  status: string;
  t: ReturnType<typeof useT>;
  trialDaysLeft: number;
}) {
  // past_due conserva el acceso mientras Stripe reintenta (ver isSubscriptionAccessActive),
  // pero hay que decirlo: el arreglo no es comprar un plan, es corregir el metodo de pago,
  // y si no se corrige el acceso se pierde al acabar los reintentos.
  if (status === "past_due") {
    return {
      cta: canManageBilling ? t("subscription.manage") : t("subscription.viewPlans"),
      icon: AlertTriangle,
      text: t("subscription.notice.pastDue.text"),
      title: t("subscription.notice.pastDue.title"),
      tone: "pastdue" as const,
      usePortal: canManageBilling,
    };
  }

  if (!accessActive) {
    return {
      cta: t("subscription.viewPlans"),
      icon: LockKeyhole,
      // Quien nunca llego a pagar y quien cancelo no estan en la misma situacion, y
      // decirle "tu prueba ha terminado" a alguien que cancelo una suscripcion suena a
      // que la app no sabe con quien habla.
      text: t("subscription.notice.expired.text"),
      title: status === "trialing" ? t("subscription.notice.expired.title") : t("subscription.notice.inactive.title"),
      tone: "expired" as const,
      usePortal: false,
    };
  }

  if (status === "trialing" && trialDaysLeft > 0 && trialDaysLeft <= TRIAL_WARNING_DAYS) {
    const template = trialDaysLeft === 1 ? t("subscription.notice.ending.titleOne") : t("subscription.notice.ending.title");
    return {
      cta: t("subscription.viewPlans"),
      icon: Clock3,
      text: t("subscription.notice.ending.text"),
      // El diccionario no interpola, pero aqui el numero va en mitad de la frase y el
      // orden cambia entre idiomas ("Te quedan 3 dias" / "3 days left"), asi que no vale
      // concatenar como en SubscriptionPanel: la plantilla lleva el hueco.
      title: template.replace("{n}", String(trialDaysLeft)),
      tone: "ending" as const,
      usePortal: false,
    };
  }

  return null;
}
