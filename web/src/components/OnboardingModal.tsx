import { Fragment, useEffect, useRef, useState } from "react";
import { Building2, Check, FileUp, Landmark, Minus, Plus, Wallet, X } from "lucide-react";
import { Modal } from "./Modal";
import { formatSizeForName } from "../lib/accountSize";
import { applyCatalogPlan, findCatalogFirm, formatCatalogDate, formatPlanLabel } from "../lib/firmCatalog";
import { getFirmLogo } from "../lib/firmLogos";
import { useI18n, useT } from "../lib/i18n/context";
import type { TranslationKey } from "../lib/i18n/es";
import { formatMoney } from "../lib/metrics";
import type { AccountInput, AccountKind, Currency, Firm, FirmInput, TradingAccount } from "../types";

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

/* Un tipo de cuenta y cuántas iguales: "3 × Challenge Flex 50K". Lo normal es tener varias
   (cinco evaluaciones del mismo plan, o evaluaciones y fondeadas a la vez), y darlas de
   alta una a una en Cuentas era justo el trabajo que este paso quiere ahorrar. */
type AccountGroup = {
  key: number;
  kind: AccountKind;
  planId: string;
  size: string;
  quantity: number;
};

type PlannedAccount = { groupKey: number; input: AccountInput };

/* Apex deja tener 20 cuentas a la vez, y es la que más permite de las que usan. */
const MAX_QUANTITY = 20;

type OnboardingModalProps = {
  accounts: TradingAccount[];
  currency: Currency;
  firms: Firm[];
  mutationError: string | null;
  /** Cerrar en cualquier paso (la X, Escape, "Ahora no"): no vuelve a salir. */
  onClose: () => void;
  /** Ya hay alguna cuenta: a partir de aquí, aunque se cierre, no vuelve a salir. */
  onAccountCreated: () => void;
  onSaveAccount: (input: AccountInput) => Promise<TradingAccount | false>;
  onSaveFirm: (input: FirmInput) => Promise<Firm | false>;
  onFinish: (destination: "trades" | "statement" | "account") => void;
};

export function OnboardingModal({
  accounts,
  currency,
  firms,
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
  const [quantity, setQuantity] = useState(1);
  /* Las ya añadidas con "Añadir otra distinta". La que está a medio elegir arriba no entra
     aquí hasta que se añade, pero sí se crea al pulsar "Crear". */
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const groupKey = useRef(0);
  const [saving, setSaving] = useState(false);
  /* Lo que se está creando, congelado: cada cuenta guardada recarga los datos y, sin esto,
     los nombres propuestos se irían corriendo ("#2" pasaría a "#3") mientras se guardan. */
  const [frozen, setFrozen] = useState<PlannedAccount[] | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [created, setCreated] = useState<TradingAccount[]>([]);
  const [createdWithRules, setCreatedWithRules] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [quoteOpen, quoteClose] = language === "en" ? ["“", "”"] : ["«", "»"];

  /* Los tres pasos comparten el cuerpo del modal, que hace scroll en un teléfono: sin esto,
     el paso 3 se abría a la altura a la que se dejó el 2 y se comía su primera línea. */
  useEffect(() => {
    rootRef.current?.closest(".modal-body")?.scrollTo({ top: 0 });
  }, [step]);

  const catalogFirm = own ? undefined : findCatalogFirm(firmName);
  const plan = catalogFirm?.plans.find((item) => item.id === planId);
  const accountKind: AccountKind = own ? "own" : kind;
  const sizeLabel = plan ? `${plan.size / 1000}K` : customOpen ? formatSizeForName(customSize) : size;
  const current: AccountGroup | undefined = sizeLabel
    ? { key: -1, kind: accountKind, planId: plan?.id || "", size: sizeLabel, quantity }
    : undefined;
  const allGroups = current ? [...groups, current] : groups;

  /* El mismo nombre que propone el alta de Cuentas (empresa + programa del plan + tamaño, y
     "#2", "#3"… si ya existe), repartido entre todas las que se van a crear. Capital propio
     no tiene empresa y usa su etiqueta de tipo. */
  const livePlanned = (() => {
    const base = own ? t("account.kind.own") : firmName.trim();
    const taken = new Set(accounts.map((account) => account.name.toLowerCase()));
    return allGroups.flatMap((group) => {
      const groupPlan = catalogFirm?.plans.find((item) => item.id === group.planId);
      const program = groupPlan && !base.toLowerCase().includes(groupPlan.program.toLowerCase()) ? `${groupPlan.program} ` : "";
      const root = `${base} ${program}${group.size}`;
      return Array.from({ length: group.quantity }, (): PlannedAccount => {
        let name = root;
        let index = 2;
        while (taken.has(name.toLowerCase())) {
          name = `${root} #${index}`;
          index += 1;
        }
        taken.add(name.toLowerCase());
        return {
          groupKey: group.key,
          input: {
            firmId: "",
            name,
            status: "active",
            kind: group.kind,
            drawdownType: "static",
            size: group.size,
            ...(groupPlan ? applyCatalogPlan(groupPlan, group.kind) : {}),
          },
        };
      });
    });
  })();
  const planned = frozen ?? livePlanned;

  const ruleItems = plan
    ? getRuleItems(
        { firmId: "", name: "", status: "active", kind: accountKind, drawdownType: "static", size: sizeLabel, ...applyCatalogPlan(plan, accountKind) },
        currency,
        t,
      )
    : [];

  const resetEditor = () => {
    setPlanId("");
    setSize("");
    setCustomSize("");
    setCustomOpen(false);
    setQuantity(1);
  };

  const chooseFirm = (name: string, isOwn = false) => {
    /* Otra empresa, otro catálogo: un plan de Lucid no tiene sentido en Apex. Volver atrás
       y elegir la misma conserva lo que ya se había añadido. */
    if (name !== firmName || isOwn !== own) {
      setGroups([]);
      resetEditor();
    }
    setFirmName(name);
    setOwn(isOwn);
    setAttempted(false);
    setStep("account");
  };

  const addAnother = () => {
    if (!current) return;
    groupKey.current += 1;
    setGroups((list) => [...list, { ...current, key: groupKey.current }]);
    resetEditor();
  };

  const createAccounts = async () => {
    if (!livePlanned.length || saving) return;
    const batch = livePlanned;
    /* La que estaba a medio elegir entra en el lote con una clave propia, para poder
       descontar sus cuentas si el guardado se corta a mitad. */
    let currentKey = -1;
    if (current) {
      groupKey.current += 1;
      currentKey = groupKey.current;
    }
    const batchGroups = current ? [...groups, { ...current, key: currentKey }] : groups;
    const keyed = batch.map((item) => (item.groupKey === -1 ? { ...item, groupKey: currentKey } : item));
    setAttempted(true);
    setSaving(true);
    setFrozen(batch);

    try {
      let firmId = "";
      if (!own) {
        /* Si la empresa ya existe (un intento anterior creó la empresa y falló una cuenta, o
           se volvió atrás), se reutiliza: repetir no debe dejar dos "Lucid Trading". */
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

      /* Una a una, como el alta de varias de Cuentas: si una falla se para ahí, y las que ya
         se guardaron salen de la lista para que reintentar no las duplique. */
      const saved: TradingAccount[] = [];
      const done = new Map<number, number>();
      for (const item of keyed) {
        const account = await onSaveAccount({ ...item.input, firmId });
        if (!account) break;
        saved.push(account);
        done.set(item.groupKey, (done.get(item.groupKey) || 0) + 1);
      }

      if (saved.length) {
        onAccountCreated();
        setCreated((list) => [...list, ...saved]);
        if (batchGroups.some((group) => group.planId && done.has(group.key))) setCreatedWithRules(true);
      }
      if (saved.length === keyed.length) {
        setGroups([]);
        resetEditor();
        setStep("next");
        return;
      }
      if (saved.length) {
        setGroups(
          batchGroups
            .map((group) => ({ ...group, quantity: group.quantity - (done.get(group.key) || 0) }))
            .filter((group) => group.quantity > 0),
        );
        resetEditor();
      }
    } finally {
      setSaving(false);
      setFrozen(null);
    }
  };

  const groupLabel = (group: AccountGroup) => {
    const groupPlan = catalogFirm?.plans.find((item) => item.id === group.planId);
    const what = groupPlan ? formatPlanLabel(groupPlan) : group.size;
    return group.kind === "own" ? what : `${t(`account.kind.${group.kind}`)} · ${what}`;
  };

  const quoted = (name: string) => `${quoteOpen}${name}${quoteClose}`;
  const names = planned.map((item) => item.input.name);
  const namesText =
    names.length <= 3
      ? names.length === 1
        ? quoted(names[0])
        : `${names.slice(0, -1).map(quoted).join(", ")} ${t("onboarding.and")} ${quoted(names[names.length - 1])}`
      : `${names.slice(0, 2).map(quoted).join(", ")} ${t("onboarding.account.andMore").replace("{n}", String(names.length - 2))}`;

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
              void createAccounts();
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
              <button className="tour-link" disabled={saving} onClick={() => setStep("firm")} type="button">
                {t("onboarding.change")}
              </button>
            </div>

            {groups.length > 0 && (
              <ul className="onboarding-groups" aria-label={t("onboarding.account.added")}>
                {groups.map((group) => (
                  <li key={group.key}>
                    <span>
                      <strong>{group.quantity} ×</strong> {groupLabel(group)}
                    </span>
                    <button
                      aria-label={`${t("onboarding.account.remove")}: ${groupLabel(group)}`}
                      disabled={saving}
                      onClick={() => setGroups((list) => list.filter((item) => item.key !== group.key))}
                      type="button"
                    >
                      <X size={14} strokeWidth={2.4} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

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

            <div className="onboarding-quantity">
              <div className="onboarding-field">
                <span id="onboarding-quantity-label">{t("onboarding.account.quantity")}</span>
                <div className="onboarding-stepper" role="group" aria-labelledby="onboarding-quantity-label">
                  <button
                    aria-label={t("onboarding.account.fewer")}
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    type="button"
                  >
                    <Minus size={16} strokeWidth={2.4} />
                  </button>
                  <output aria-live="polite">{quantity}</output>
                  <button
                    aria-label={t("onboarding.account.more")}
                    disabled={quantity >= MAX_QUANTITY}
                    onClick={() => setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))}
                    type="button"
                  >
                    <Plus size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
              <button className="ghost-action" disabled={!current || saving} onClick={addAnother} type="button">
                <Plus size={16} strokeWidth={2.2} />
                {t("onboarding.account.addAnother")}
              </button>
            </div>

            {names.length > 0 && (
              <p className="onboarding-note">
                {names.length === 1 ? t("onboarding.account.name") : t("onboarding.account.names")} <strong>{namesText}</strong>.{" "}
                {!own && !catalogFirm ? t("onboarding.account.noRules") : t("onboarding.account.nameHint")}
              </p>
            )}

            {attempted && !saving && mutationError && (
              <p className="mutation-message error">
                {created.length > 0 && `${t("onboarding.account.partial").replace("{n}", String(created.length))} `}
                {mutationError}
              </p>
            )}

            <div className="form-action-row">
              <button className="ghost-action" disabled={saving} onClick={() => setStep("firm")} type="button">
                {t("onboarding.back")}
              </button>
              <button className="primary-action" disabled={!planned.length || saving} type="submit">
                <Check size={17} strokeWidth={2.2} />
                {saving
                  ? t("common.saving")
                  : planned.length > 1
                    ? t("onboarding.account.createMany").replace("{n}", String(planned.length))
                    : t("onboarding.account.create")}
              </button>
            </div>
          </form>
        )}

        {step === "next" && created.length > 0 && (
          <div className="onboarding">
            <div className="onboarding-done">
              <span aria-hidden="true">
                <Check size={18} strokeWidth={2.4} />
              </span>
              <p>
                {created.length === 1
                  ? (createdWithRules ? t("onboarding.next.createdRules") : t("onboarding.next.created")).replace(
                      "{name}",
                      created[0].name,
                    )
                  : (createdWithRules ? t("onboarding.next.createdManyRules") : t("onboarding.next.createdMany")).replace(
                      "{n}",
                      String(created.length),
                    )}
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
