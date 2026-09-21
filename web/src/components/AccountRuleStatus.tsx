import { Check, Circle } from "lucide-react";
import { InfoHint } from "./InfoHint";
import { useI18n, useT, type Language } from "../lib/i18n/context";
import { getPendingRuleCheck, type AccountRuleCheck, type AccountRuleStatus } from "../lib/accountRules";
import { formatAmount, formatMoney, formatPercentCompact } from "../lib/metrics";
import type { Currency, TradingAccount } from "../types";

/**
 * Como se ensena el estado de las reglas de cobro (lib/accountRules.ts). Dos formas de
 * lo mismo y en un solo sitio: el panel entero, que vive en el Journal junto a la barra
 * de recorrido de la cuenta, y una linea para la tarjeta de Cuentas, donde solo cabe la
 * regla que falta. Separarlas en dos ficheros habria dejado dos copias de las mismas
 * decisiones de formato (que "3 / 5" son dias y "46 %" es el peso del mejor dia).
 */

/* Cada regla se lee en la unidad en la que la escribe la firma, no en una comun: los
   dias en dias, el minimo en dinero y la consistencia en porcentaje. Traducirlas todas
   a un mismo "% completado" las haria comparables entre si, que es justo lo que no son. */
function formatCheckValue(check: AccountRuleCheck, currency: Currency, t: ReturnType<typeof useT>) {
  if (check.id === "profitDays") return `${check.current} / ${check.required}`;
  /* Las dos de dinero se leen igual, "donde vas / lo que pide": una mide el ciclo y la
     otra lo que queda en la cuenta, y el nombre de la fila ya dice cual es cual. */
  if (check.id === "payoutMin" || check.id === "withdrawMin") {
    return `${formatAmount(check.current)} / ${formatMoney(check.required, currency)}`;
  }
  /* Consistencia sin beneficio en el ciclo: no hay reparto que medir todavia, y un
     "0 %" ahi se leeria como un dato tranquilizador cuando no lo es. */
  if (!check.missing && !check.current) return t("account.rules.noProfitYet");
  return `${formatPercentCompact(check.current / 100)} · ${t("account.rules.limitPrefix")} ${formatPercentCompact(check.required / 100)}`;
}

/* Lo que falta va siempre con "+" y nunca con un verbo ("faltan 2 dias"): el signo
   funciona igual en los dos idiomas y se salta la concordancia de singular y plural,
   que en castellano cambia el verbo y en ingles no. */
function formatCheckMissing(check: AccountRuleCheck, currency: Currency, t: ReturnType<typeof useT>) {
  if (check.missing === undefined || check.missing <= 0) return null;
  if (check.id === "profitDays") {
    return `+${check.missing} ${check.missing === 1 ? t("account.rules.dayUnit") : t("account.rules.daysUnit")}`;
  }
  return `+${formatMoney(check.missing, currency)}`;
}

/* La fecha del payout que cerro el ciclo, en corto y en el idioma de la interfaz. Se
   construye con mediodia y no a las 00:00 para que el desfase horario no devuelva el dia
   anterior, el mismo cuidado que toma el resto de la app al pasar de "2026-09-12" a
   Date. */
function formatCycleDate(date: string, language: Language) {
  const [year, month, day] = date.split("-").map(Number);
  /* Mes completo y no abreviado: la frase la completa una preposicion en cada idioma
     ("del 8 de mayo", "on May 8") y con el mes en corto se leia como una etiqueta de
     eje de grafico metida en medio de una frase. */
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", { day: "numeric", month: "long" }).format(
    new Date(year, (month || 1) - 1, day || 1, 12),
  );
}

function checkName(check: AccountRuleCheck, t: ReturnType<typeof useT>) {
  if (check.id === "payoutMin") return t("account.rules.payoutMin");
  if (check.id === "withdrawMin") return t("account.rules.withdrawMin");
  if (check.id === "profitDays") return t("account.rules.profitDays");
  return t("account.rules.consistency");
}

function StatusBadge({ account, status }: { account: TradingAccount; status: AccountRuleStatus }) {
  const t = useT();
  const pending = status.checks.filter((check) => !check.met).length;

  if (status.ready) {
    return (
      <span className="account-rules-badge is-ready">
        <Check size={13} strokeWidth={2.6} />
        {/* Una evaluacion no "cobra": ahi cumplir las reglas es condicion para aprobar,
            no para pedir dinero. Decirle "listo para cobrar" a quien esta en fase 1 seria
            prometerle algo que su cuenta todavia no puede hacer. */}
        {account.kind === "funded" ? t("account.rules.readyPayout") : t("account.rules.readyRules")}
      </span>
    );
  }

  return (
    <span className="account-rules-badge is-pending">
      {pending === 1 ? t("account.rules.pendingOne") : `${pending} ${t("account.rules.pendingMany")}`}
    </span>
  );
}

export function AccountRuleStatusPanel({
  account,
  currency,
  status,
}: {
  account: TradingAccount;
  currency: Currency;
  status: AccountRuleStatus;
}) {
  const { language, t } = useI18n();

  return (
    <div className="account-rules">
      <div className="account-rules-head">
        {/* Mismo titulo que el bloque de campos del formulario, y por el mismo motivo:
            en una evaluacion estas reglas no dan acceso a cobrar sino a aprobar. */}
        <h3>{account.kind === "funded" ? t("account.rules.titlePayout") : t("account.rules.titleEvaluation")}</h3>
        <StatusBadge account={account} status={status} />
      </div>

      {/* El ciclo primero y en pequeno: es el marco que hace que las cifras de abajo
          signifiquen algo (el mismo beneficio puede cumplir un ciclo y no el anterior). */}
      <p className="account-rules-cycle">
        {status.cycle.closedAt
          ? `${t("account.rules.sinceLastPayoutPrefix")} ${formatCycleDate(status.cycle.closedAt, language)}`
          : t("account.rules.sinceStart")}
        <em>
          {t("account.rules.cycleProfit")} {formatMoney(status.cycle.profit, currency)}
        </em>
      </p>

      <ul className="account-rules-list">
        {status.checks.map((check) => {
          const missing = formatCheckMissing(check, currency, t);
          return (
            <li className={`account-rule ${check.met ? "is-met" : "is-pending"}`} key={check.id}>
              <span className="account-rule-name">
                {check.met ? <Check size={14} strokeWidth={2.6} /> : <Circle size={14} strokeWidth={2.2} />}
                {checkName(check, t)}
                {check.id === "profitDays" && account.profitDayMin ? (
                  <em>
                    {t("account.rules.minPrefix")} {formatMoney(account.profitDayMin, currency)}
                  </em>
                ) : null}
              </span>
              <span className="account-rule-value">{formatCheckValue(check, currency, t)}</span>
              {/* La celda de lo que falta se pinta siempre, vacia cuando no falta nada:
                  las filas son `display: contents` sobre una rejilla de tres columnas, y
                  una celda de menos correria las de las filas siguientes un hueco. */}
              <span className="account-rule-missing">
                {missing}
                {missing && check.id === "consistency" && <InfoHint text={t("account.rules.consistencyMissingHint")} />}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** La version de una linea, para la tarjeta de Cuentas: la insignia y, si falta algo, la
 *  primera regla pendiente con su cifra. El detalle completo esta en el Journal. */
export function AccountRuleStatusLine({
  account,
  currency,
  status,
}: {
  account: TradingAccount;
  currency: Currency;
  status: AccountRuleStatus;
}) {
  const t = useT();
  const pending = getPendingRuleCheck(status);
  const missing = pending ? formatCheckMissing(pending, currency, t) : null;

  return (
    <p className="account-rules-line">
      <StatusBadge account={account} status={status} />
      {pending && (
        <span>
          {checkName(pending, t)}
          <strong>{missing || formatCheckValue(pending, currency, t)}</strong>
        </span>
      )}
    </p>
  );
}

/**
 * Lo que se ve en el Journal cuando la cuenta todavia no tiene ninguna regla de cobro.
 * Antes no se veia nada, y esa era la razon de que un dia despues de desplegar las reglas
 * ninguna cuenta las tuviera: la funcion solo existia para quien abriera la ficha de la
 * cuenta y bajara hasta el final del formulario. Si la empresa esta en el catalogo, el
 * aviso ofrece lo corto (elegir el plan) en vez de lo largo (teclear las reglas).
 */
export function AccountRuleEmpty({ inCatalog, onEdit }: { inCatalog: boolean; onEdit?: () => void }) {
  const t = useT();
  return (
    <div className="account-rules account-rules-empty">
      <p>{inCatalog ? t("account.rules.emptyCatalog") : t("account.rules.empty")}</p>
      {onEdit && (
        <button className="ghost-action compact-action" onClick={onEdit} type="button">
          {inCatalog ? t("account.rules.emptyCatalogAction") : t("account.rules.emptyAction")}
        </button>
      )}
    </div>
  );
}
