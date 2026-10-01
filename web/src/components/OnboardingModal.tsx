import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, FileUp, Landmark, Wallet } from "lucide-react";
import { Modal } from "./Modal";
import { formatSizeForName } from "../lib/db";
import { applyCatalogPlan, findCatalogFirm, formatCatalogDate, formatPlanLabel } from "../lib/firmCatalog";
import { getFirmLogo } from "../lib/firmLogos";
import { useI18n, useT } from "../lib/i18n/context";
import type { TranslationKey } from "../lib/i18n/es";
import { formatMoney } from "../lib/metrics";
import type { AccountInput, Currency, Firm, FirmInput, TradingAccount } from "../types";

/**
 * Primer arranque: empresa -> cuenta (con el plan del catálogo si lo hay) -> operaciones.
 *
 * Existe por el dato de la auditoría del 30 de septiembre de 2026: 26 de los 42 usuarios
 * con la prueba caducada no crearon nada. Entraban a un Panel lleno de ceros, y lo que
 * diferencia a Trazza (las reglas de cobro, el catálogo de Lucid, el extracto del banco)
 * quedaba a tres pantallas y un formulario de trece campos de distancia. Aquí son tres
 * clics hasta tener una cuenta con sus reglas puestas.
 *
 * No crea nada por su cuenta: usa las mismas escrituras que Empresas y Cuentas (pasan por
 * guard() en App, así que respetan el paywall), y el tercer paso solo lleva a la pantalla
 * que toca con su ventana abierta. Lo que aquí no se pide (fecha de compra, reglas de una
 * firma fuera del catálogo) se completa luego en Cuentas.
 */

/* Las firmas de los usuarios de verdad (medido el 17 de septiembre de 2026: Lucid 20,
   Alpha 7, y luego Tradeify, Apex y Topstep), todas de futuros. Con el nombre que usa cada
   una, porque es el que se guarda y el que reconocen la importación del extracto y el
   catálogo. */
const SUGGESTED_FIRMS = ["Lucid Trading", "Alpha Futures", "Apex", "Topstep", "Tradeify", "MyFundedFutures", "Take Profit Trader"];
const SIZE_CHIPS = ["25K", "50K", "100K", "150K"];

type Step = "firm" | "account" | "next";

type OnboardingModalProps = {
  accounts: TradingAccount[];
  currency: Currency;
  firms: Firm[];
  mutating: boolean;
  mutationError: string | null;
  /** Cerrar en cualquier paso (la X, Escape, "Ahora no"): no vuelve a salir. */
  onClose: () => void;
  /** La cuenta ya existe: a partir de aquí, aunque se cierre, no vuelve a salir. */
  onAccountCreated: () => void;
  onSaveAccount: (input: AccountInput) => Promise<TradingAccount | false>;
  onSaveFirm: (input: FirmInput) => Promise<Firm | false>;
  onFinish: (destination: "trades" | "statement" | "account") => void;
};

export function OnboardingModal({
  accounts,
  currency,
  firms,
  mutating,
  mutationError,
  onClose,
  onAccountCreated,
  onSaveAccount,
  onSaveFirm,
  onFinish,
}: OnboardingModalProps) {
  const t = useT();
  const { language } = useI18n();
  const [step, setStep] = useState<Step>("firm");
  const [firmName, setFirmName] = useState("");
  const [own, setOwn] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [kind, setKind] = useState<"challenge" | "funded">("challenge");
  const [planId, setPlanId] = useState("");
  const [size, setSize] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [created, setCreated] = useState<TradingAccount>();
  const rootRef = useRef<HTMLDivElement>(null);
  const [quoteOpen, quoteClose] = language === "en" ? ["“", "”"] : ["«", "»"];

  /* Los tres pasos comparten el cuerpo del modal, que hace scroll en un teléfono: sin esto,
     el paso 3 se abría a la altura a la que se dejó el 2 y se comía su primera línea. */
  useEffect(() => {
    rootRef.current?.closest(".modal-body")?.scrollTo({ top: 0 });
  }, [step]);

  const catalogFirm = own ? undefined : findCatalogFirm(firmName);
  const plan = catalogFirm?.plans.find((item) => item.id === planId);
  const accountKind = own ? "own" : kind;
  const sizeLabel = plan ? `${plan.size / 1000}K` : customOpen ? formatSizeForName(customSize) : size;

  /* El mismo nombre que propone el alta de Cuentas: empresa + programa del plan + tamaño,
     con "#2" si ya existe. Capital propio no tiene empresa y usa su etiqueta de tipo. */
  const accountName = useMemo(() => {
    const base = own ? t("account.kind.own") : firmName.trim();
    if (!base || !sizeLabel) return "";
    const program = plan && !base.toLowerCase().includes(plan.program.toLowerCase()) ? `${plan.program} ` : "";
    const name = `${base} ${program}${sizeLabel}`;
    const taken = accounts.map((account) => account.name.toLowerCase());
    if (!taken.includes(name.toLowerCase())) return name;
    let index = 2;
    while (taken.includes(`${name} #${index}`.toLowerCase())) index += 1;
    return `${name} #${index}`;
  }, [accounts, firmName, own, plan, sizeLabel, t]);

  const input: AccountInput = {
    firmId: "",
    name: accountName,
    status: "active",
    kind: accountKind,
    drawdownType: "static",
    size: sizeLabel,
    ...(plan ? applyCatalogPlan(plan, accountKind) : {}),
  };
  const ruleItems = getRuleItems(input, currency, t);

  const chooseFirm = (name: string, isOwn = false) => {
    setFirmName(name);
    setOwn(isOwn);
    /* Otra empresa, otro catálogo: un plan de Lucid no tiene sentido en Apex. El tamaño
       sí se conserva, por si se vuelve atrás solo para corregir una errata. */
    setPlanId("");
    setAttempted(false);
    setStep("account");
  };

  const createAccount = async () => {
    if (!accountName || mutating) return;
    setAttempted(true);

    let firmId = "";
    if (!own) {
      /* Si la empresa ya existe (un intento anterior creó la empresa y falló la cuenta, o se
         volvió atrás), se reutiliza: repetir no debe dejar dos "Lucid Trading". */
      const key = firmName.trim().toLowerCase();
      const existing = firms.find((firm) => firm.name.trim().toLowerCase() === key);
      if (existing) {
        firmId = existing.id;
      } else {
        const firm = await onSaveFirm({
          name: firmName.trim(),
          type: SUGGESTED_FIRMS.includes(firmName) || catalogFirm ? "futures" : "other",
        });
        if (!firm) return;
        firmId = firm.id;
      }
    }

    const account = await onSaveAccount({ ...input, firmId });
    if (!account) return;
    setCreated(account);
    onAccountCreated();
    setStep("next");
  };

  const stepNumber = step === "firm" ? 1 : step === "account" ? 2 : 3;
  const title =
    step === "firm" ? t("onboarding.firm.title") : step === "account" ? t("onboarding.account.title") : t("onboarding.next.title");

  return (
    <Modal onClose={onClose} subtitle={t("onboarding.step").replace("{n}", String(stepNumber))} title={title}>
      <div ref={rootRef}>
        {step === "firm" && (
          <div className="onboarding">
            <p className="onboarding-intro">{t("onboarding.firm.intro")}</p>
            <div className="onboarding-firms">
              {SUGGESTED_FIRMS.map((name) => (
                <button className="onboarding-firm" key={name} onClick={() => chooseFirm(name)} type="button">
                  <FirmMark name={name} />
                  <span>
                    <BreakableName name={name} />
                  </span>
                </button>
              ))}
              <button
                aria-expanded={otherOpen}
                className={`onboarding-firm ${otherOpen ? "is-active" : ""}`}
                onClick={() => setOtherOpen((open) => !open)}
                type="button"
              >
                <span className="firm-avatar" aria-hidden="true">
                  <Building2 size={18} strokeWidth={2.2} />
                </span>
                <span>{t("onboarding.firm.other")}</span>
              </button>
              <button className="onboarding-firm" onClick={() => chooseFirm("", true)} type="button">
                <span className="firm-avatar" aria-hidden="true">
                  <Wallet size={18} strokeWidth={2.2} />
                </span>
                <span>{t("account.kind.own")}</span>
              </button>
            </div>

            {otherOpen && (
              <form
                className="onboarding-inline"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (otherName.trim()) chooseFirm(otherName.trim());
                }}
              >
                <input
                  aria-label={t("onboarding.firm.otherPlaceholder")}
                  autoFocus
                  onChange={(event) => setOtherName(event.target.value)}
                  placeholder={t("onboarding.firm.otherPlaceholder")}
                  value={otherName}
                />
                <button className="primary-action" disabled={!otherName.trim()} type="submit">
                  {t("onboarding.continue")}
                </button>
              </form>
            )}

            <div className="onboarding-footer">
              <button className="tour-link" onClick={onClose} type="button">
                {t("onboarding.skip")}
              </button>
            </div>
          </div>
        )}

        {step === "account" && (
          <form
            className="onboarding"
         
            onSubmit={(event) => {
              event.preventDefault();
              void createAccount();
            }}
          >
            <div className="onboarding-chosen">
              {own ? (
                <span className="firm-avatar" aria-hidden="true">
                  <Wallet size={18} strokeWidth={2.2} />
                </span>
              ) : (
                <FirmMark name={firmName} />
              )}
              <strong>{own ? t("account.kind.own") : firmName}</strong>
              <button className="tour-link" disabled={mutating} onClick={() => setStep("firm")} type="button">
                {t("onboarding.change")}
              </button>
            </div>

            {!own && (
              <div className="onboarding-field">
                <span>{t("account.field.kind")}</span>
                <div className="segmented-control">
                  {(["challenge", "funded"] as const).map((value) => (
                    <button
                      aria-pressed={kind === value}
                      className={kind === value ? "active" : ""}
                      key={value}
                      onClick={() => setKind(value)}
                      type="button"
                    >
                      {t(`account.kind.${value}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {catalogFirm ? (
              <div className="onboarding-field">
                <span>{t("account.field.plan")}</span>
                {[...new Set(catalogFirm.plans.map((item) => item.program))].map((program) => (
                  <div className="onboarding-plan-row" key={program}>
                    <strong>{program}</strong>
                    <div className="onboarding-chips">
                      {catalogFirm.plans
                        .filter((item) => item.program === program)
                        .map((item) => (
                          <button
                            aria-label={formatPlanLabel(item)}
                            aria-pressed={planId === item.id}
                            className={`onboarding-chip ${planId === item.id ? "is-active" : ""}`}
                            key={item.id}
                            onClick={() => setPlanId(item.id)}
                            type="button"
                          >
                            {item.size / 1000}K
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="onboarding-field">
                <span>{own ? t("onboarding.account.capital") : t("account.field.size")}</span>
                <div className="onboarding-chips">
                  {SIZE_CHIPS.map((chip) => (
                    <button
                      aria-pressed={!customOpen && size === chip}
                      className={`onboarding-chip ${!customOpen && size === chip ? "is-active" : ""}`}
                      key={chip}
                      onClick={() => {
                        setSize(chip);
                        setCustomOpen(false);
                      }}
                      type="button"
                    >
                      {chip}
                    </button>
                  ))}
                  <button
                    aria-pressed={customOpen}
                    className={`onboarding-chip ${customOpen ? "is-active" : ""}`}
                    onClick={() => setCustomOpen(true)}
                    type="button"
                  >
                    {t("onboarding.account.customSize")}
                  </button>
                </div>
                {customOpen && (
                  <input
                    aria-label={own ? t("onboarding.account.capital") : t("account.field.size")}
                    autoFocus
                    inputMode="decimal"
                    onChange={(event) => setCustomSize(event.target.value)}
                    placeholder={t("onboarding.account.customPlaceholder")}
                    value={customSize}
                  />
                )}
              </div>
            )}

            {plan && catalogFirm && (
              <section className="onboarding-summary" aria-live="polite">
                <strong>{t("onboarding.account.rulesLoaded")}</strong>
                <dl>
                  {ruleItems.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="onboarding-note">
                  {t("onboarding.account.rulesChecked")} {formatCatalogDate(catalogFirm.verifiedAt, language)}.
                </p>
              </section>
            )}

            {accountName && (
              <p className="onboarding-note">
                {t("onboarding.account.name")}{" "}
                <strong>
                  {quoteOpen}
                  {accountName}
                  {quoteClose}
                </strong>
                .{" "}
                {!own && !catalogFirm ? t("onboarding.account.noRules") : t("onboarding.account.nameHint")}
              </p>
            )}

            {attempted && !mutating && mutationError && <p className="mutation-message error">{mutationError}</p>}

            <div className="form-action-row">
              <button className="ghost-action" disabled={mutating} onClick={() => setStep("firm")} type="button">
                {t("onboarding.back")}
              </button>
              <button className="primary-action" disabled={!accountName || mutating} type="submit">
                <Check size={17} strokeWidth={2.2} />
                {mutating ? t("common.saving") : t("onboarding.account.create")}
              </button>
            </div>
          </form>
        )}

        {step === "next" && created && (
          <div className="onboarding">
            <div className="onboarding-done">
              <span aria-hidden="true">
                <Check size={18} strokeWidth={2.4} />
              </span>
              <p>
                {(plan ? t("onboarding.next.createdRules") : t("onboarding.next.created")).replace("{name}", created.name)}
              </p>
            </div>
            <div className="journal-entry-mode-grid onboarding-options">
              <button className="journal-entry-mode-option" onClick={() => onFinish("trades")} type="button">
                <FileUp size={20} strokeWidth={2.2} />
                <strong>{t("onboarding.next.trades")}</strong>
                <span>{t("onboarding.next.tradesHint")}</span>
              </button>
              <button className="journal-entry-mode-option" onClick={() => onFinish("statement")} type="button">
                <Landmark size={20} strokeWidth={2.2} />
                <strong>{t("onboarding.next.statement")}</strong>
                <span>{t("onboarding.next.statementHint")}</span>
              </button>
            </div>
            <div className="onboarding-footer">
              <button className="tour-link" onClick={() => onFinish("account")} type="button">
                {t("onboarding.next.later")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* "MyFundedFutures" no cabe en la tarjeta de un teléfono y, sin un sitio por donde
   partirlo, se cortaba letra a letra ("MyFund / edFutur / es"). Se ofrecen como cortes los
   cambios de mayúscula, que es donde la propia marca separa las palabras. */
function BreakableName({ name }: { name: string }) {
  const parts = name.split(/(?<=[a-z])(?=[A-Z])/);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function FirmMark({ name }: { name: string }) {
  const logo = getFirmLogo(name);
  if (logo) {
    return (
      <span className="firm-avatar has-logo" aria-hidden="true">
        <img alt="" src={logo} />
      </span>
    );
  }
  return (
    <span className="firm-avatar" aria-hidden="true">
      <Building2 size={18} strokeWidth={2.2} />
    </span>
  );
}

/* Lo que el plan rellena, para que se vea que se ha rellenado: es la razón de elegir un
   plan en vez de un tamaño, y lo que ninguna otra pantalla enseña antes de tener trades. */
function getRuleItems(input: AccountInput, currency: Currency, t: (key: TranslationKey) => string): [string, string][] {
  const items: [string, string][] = [];
  if (input.phaseTarget) items.push([t("account.field.target"), formatMoney(input.phaseTarget, currency)]);
  if (input.maxDrawdown) {
    items.push([
      t("account.field.maxDrawdown"),
      `${formatMoney(input.maxDrawdown, currency)} · ${t(`account.drawdownType.${input.drawdownType}`)}`,
    ]);
  }
  if (input.dailyDrawdown) items.push([t("account.field.dailyDrawdown"), formatMoney(input.dailyDrawdown, currency)]);
  if (input.consistencyPct) items.push([t("account.rules.consistency"), `${input.consistencyPct} %`]);
  if (input.minProfitDays) {
    items.push([
      t("account.rules.profitDays"),
      `${input.minProfitDays} ${t("account.rules.daysUnit")}${input.profitDayMin ? ` · ${t("account.rules.minPrefix")} ${formatMoney(input.profitDayMin, currency)}` : ""}`,
    ]);
  }
  if (input.payoutMin) items.push([t("account.rules.payoutMin"), formatMoney(input.payoutMin, currency)]);
  if (input.withdrawMinProfit) items.push([t("account.rules.withdrawMin"), formatMoney(input.withdrawMinProfit, currency)]);
  return items;
}
