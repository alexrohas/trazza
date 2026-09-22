import { useMemo, useRef, useState, type DragEvent } from "react";
import { FileUp, Plus } from "lucide-react";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { expenseCategories, getMovementCategoryLabels, incomeCategories } from "./MovementsView";
import {
  BankImportError,
  findReversedKeys,
  guessMovement,
  findAlreadyImported,
  matchBankRow,
  parseBankStatement,
  type BankMatch,
  type BankRow,
  type BankSource,
  type ImportMatch,
} from "../lib/bankImport";
import { createUuid } from "../lib/db";
import { loadEcbRates } from "../lib/fxRates";
import { formatMoney } from "../lib/metrics";
import { useT } from "../lib/i18n/context";
import type {
  Currency,
  Firm,
  FirmInput,
  Movement,
  MovementCategory,
  MovementInput,
  MovementKind,
  TradingAccount,
} from "../types";

export type AccountRequestRow = { movementId: string; firmId: string; purchasedAt: string };

type BankImportModalProps = {
  accounts: TradingAccount[];
  canWrite: boolean;
  currency: Currency;
  firms: Firm[];
  /** Todos, no los filtrados por cuenta: la comprobacion de duplicados mira el total. */
  movements: Movement[];
  mutating: boolean;
  mutationError?: string | null;
  onClose: () => void;
  /** Devuelve el id de cada empresa creada por nombre, o false si fallo. */
  onImport: (items: { id: string; input: MovementInput; newFirm?: FirmInput }[]) => Promise<Record<string, string> | false>;
  /** Las compras marcadas con "crear cuenta": se abre el alta de varias cuentas en Cuentas. */
  onRequestAccounts: (rows: AccountRequestRow[]) => void;
};

/* Prefijo de la opcion "crear esta empresa" del selector: no choca con un id real (uuid). */
const NEW_FIRM_PREFIX = "new:";
/* Opcion "crear cuenta nueva" del selector de cuenta. Mismo valor que en el formulario de
   un movimiento. */
const NEW_ACCOUNT = "__new_account__";

type ReviewRow = {
  row: BankRow;
  match: BankMatch;
  kind: MovementKind;
  /** Importe positivo ya en la divisa del usuario; undefined si no hubo cambio. */
  amount?: number;
  reversed: boolean;
};

type Review = {
  source: BankSource;
  total: number;
  rows: ReviewRow[];
  converted: boolean;
};

const SOURCE_LABELS: Record<BankSource, string> = { revolut: "Revolut", wise: "Wise" };

/* Pasos para sacar el CSV de cada banco, comprobados contra su ayuda oficial el 22 de
   septiembre de 2026. Si un banco cambia sus menus, esto es lo que hay que revisar:
   - Revolut (help.revolut.com, "Download an account statement"): el formato se llama
     "Excel" pero descarga un .csv, que es lo que lee la importacion.
   - Wise (wise.com/help, "How do I download a statement?"): solo desde la web o
     Android, un maximo de 365 dias por extracto. */
const GUIDE_STEPS: Record<BankSource, string[]> = {
  revolut: ["movement.import.guide.revolut1", "movement.import.guide.revolut2", "movement.import.guide.revolut3", "movement.import.guide.revolut4"],
  wise: ["movement.import.guide.wise1", "movement.import.guide.wise2", "movement.import.guide.wise3", "movement.import.guide.wise4"],
};

export function BankImportModal({
  accounts,
  canWrite,
  currency,
  firms,
  movements,
  mutating,
  mutationError,
  onClose,
  onImport,
  onRequestAccounts,
}: BankImportModalProps) {
  const t = useT();
  const categoryLabels = useMemo(() => getMovementCategoryLabels(t), [t]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [firmChoice, setFirmChoice] = useState<Record<string, string>>({});
  const [categoryChoice, setCategoryChoice] = useState<Record<string, MovementCategory>>({});
  const [accountChoice, setAccountChoice] = useState<Record<string, string>>({});
  const [guideBank, setGuideBank] = useState<BankSource>("revolut");

  const movementCountByFirm = useMemo(() => {
    const counts = new Map<string, number>();
    movements.forEach((movement) => counts.set(movement.firmId, (counts.get(movement.firmId) || 0) + 1));
    return counts;
  }, [movements]);

  /**
   * La cuenta que se propone para cada fila:
   * - La compra de un challenge crea su cuenta, salvo que ya exista una de esa empresa
   *   comprada ese mismo dia y aun sin cargo enlazado: entonces es esa (quien las creo a
   *   mano antes de importar no acaba con dos). `used` evita dar la misma cuenta a dos
   *   cargos del mismo dia.
   * - Un payout va a la fondeada de esa empresa si solo hay una viva; con varias no se
   *   puede adivinar y se deja sin cuenta.
   * - Lo demas (resets, activaciones, devoluciones, plataformas), sin cuenta.
   */
  const defaultAccountFor = (item: ReviewRow, firmValue: string, category: MovementCategory, used: Set<string>) => {
    if (firmValue.startsWith(NEW_FIRM_PREFIX)) return item.kind === "expense" && category === "challenge" ? NEW_ACCOUNT : "";
    if (!firmValue) return "";
    if (item.kind === "expense") {
      if (category !== "challenge") return "";
      /* Con la fecha de compra a tres dias como mucho, el mismo margen que los duplicados:
         la cuenta se da de alta el dia que se compra, y el banco puede anotarlo al siguiente. */
      const existing = accounts.find(
        (account) =>
          account.firmId === firmValue &&
          Boolean(account.purchasedAt) &&
          Math.abs(Date.parse(account.purchasedAt) - Date.parse(item.row.date)) <= 3 * 86_400_000 &&
          !used.has(account.id) &&
          !movements.some((movement) => movement.accountId === account.id && movement.category === "challenge"),
      );
      if (existing) used.add(existing.id);
      return existing?.id || NEW_ACCOUNT;
    }
    if (category !== "payout") return "";
    /* Un extracto trae historia: el payout de julio es de la fondeada que lo pago, aunque
       hoy este cerrada. Primero la unica viva; si no, la unica que haya. */
    const funded = accounts.filter((account) => account.firmId === firmValue && account.kind === "funded");
    const live = funded.filter((account) => account.status !== "failed" && account.status !== "closed");
    if (live.length === 1) return live[0].id;
    return funded.length === 1 ? funded[0].id : "";
  };

  /* Que filas ya estan guardadas, segun la empresa elegida en cada una. Se recalcula al
     cambiar la empresa de una fila, porque casar depende de ella. Las empresas por crear
     no pueden tener nada guardado. */
  const matchedByKey = useMemo(() => {
    if (!review) return new Map<string, ImportMatch>();
    return findAlreadyImported(
      review.rows.flatMap((item) => {
        const firmValue = firmChoice[item.row.key] || "";
        if (item.amount === undefined || firmValue.startsWith(NEW_FIRM_PREFIX)) return [];
        return [
          {
            key: item.row.key,
            date: item.row.date,
            kind: item.kind,
            firmId: firmValue,
            amount: item.amount,
            converted: item.row.currency !== currency,
          },
        ];
      }),
      movements,
    );
  }, [currency, firmChoice, movements, review]);

  const readFile = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const statement = parseBankStatement(await file.text());
      const matched = statement.rows.flatMap((row) => {
        const match = matchBankRow(row, firms, movementCountByFirm);
        return match ? [{ row, match }] : [];
      });
      const reversed = findReversedKeys(matched.map((item) => ({ row: item.row, label: item.match.name })));

      /* Un cambio por divisa del extracto (Wise puede traer varias si se exporta todo). */
      const rateByCurrency = new Map<string, (date: string) => number | undefined>();
      let rateFailed = false;
      for (const code of new Set(matched.map((item) => item.row.currency))) {
        try {
          rateByCurrency.set(
            code,
            await loadEcbRates(code, currency, matched.filter((item) => item.row.currency === code).map((item) => item.row.date)),
          );
        } catch {
          rateFailed = true;
        }
      }

      const rows: ReviewRow[] = matched.map(({ row, match }) => {
        const rate = rateByCurrency.get(row.currency)?.(row.date);
        return {
          row,
          match,
          kind: row.amount < 0 ? "expense" : "income",
          amount: rate === undefined ? undefined : Math.round(Math.abs(row.amount) * rate * 100) / 100,
          reversed: reversed.has(row.key),
        };
      });

      const firmDefaults: Record<string, string> = {};
      const categoryDefaults: Record<string, MovementCategory> = {};
      rows.forEach((item) => {
        firmDefaults[item.row.key] =
          item.match.kind === "platform" ? "" : item.match.firmId || `${NEW_FIRM_PREFIX}${item.match.name}`;
        categoryDefaults[item.row.key] = guessMovement(item.row, item.match).category;
      });
      const alreadyImported = findAlreadyImported(
        rows.flatMap((item) => {
          const firmValue = firmDefaults[item.row.key];
          if (item.amount === undefined || firmValue.startsWith(NEW_FIRM_PREFIX)) return [];
          return [
            {
              key: item.row.key,
              date: item.row.date,
              kind: item.kind,
              firmId: firmValue,
              amount: item.amount,
              converted: item.row.currency !== currency,
            },
          ];
        }),
        movements,
      );
      const accountDefaults: Record<string, string> = {};
      const selectedDefaults = new Set<string>();
      const usedAccounts = new Set<string>();
      /* En orden de fecha: si hay dos cuentas compradas el mismo dia, la primera cuenta
         existente va al primer cargo. Lo ya importado no propone cuenta: su compra ya esta
         apuntada, y proponer "crear cuenta nueva" ahi invitaria a duplicarla. */
      [...rows].sort((left, right) => left.row.date.localeCompare(right.row.date)).forEach((item) => {
        const key = item.row.key;
        const duplicate = alreadyImported.has(key);
        accountDefaults[key] = duplicate ? "" : defaultAccountFor(item, firmDefaults[key], categoryDefaults[key], usedAccounts);
        if (!duplicate && !item.reversed && item.amount !== undefined) selectedDefaults.add(key);
      });

      setFirmChoice(firmDefaults);
      setCategoryChoice(categoryDefaults);
      setAccountChoice(accountDefaults);
      setSelected(selectedDefaults);
      setReview({
        source: statement.source,
        total: statement.rows.length,
        rows: rows.sort((left, right) => right.row.date.localeCompare(left.row.date)),
        converted: rows.some((item) => item.row.currency !== currency),
      });
      if (rateFailed) setError(t("movement.import.rateError"));
    } catch (caught) {
      setError(
        caught instanceof BankImportError && caught.code === "empty"
          ? t("movement.import.errorEmpty")
          : t("movement.import.errorFormat"),
      );
    } finally {
      setReading(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !reading) void readFile(file);
  };

  const firmOptionsFor = (item: ReviewRow) => [
    ...(item.match.kind === "firm" && !item.match.firmId
      ? [{ label: `${t("movement.import.createFirm")} «${item.match.name}»`, value: `${NEW_FIRM_PREFIX}${item.match.name}`, accent: true }]
      : []),
    { label: t("movement.field.firmGeneral"), value: "" },
    ...firms.map((firm) => ({ label: firm.name, value: firm.id })),
  ];

  const accountOptionsFor = (item: ReviewRow) => {
    const firmValue = firmChoice[item.row.key] || "";
    /* Tambien las ocultas y las cerradas, al reves que en el formulario de un movimiento:
       un extracto trae historia, y el cargo de marzo es de la cuenta de marzo aunque hoy ya
       no se vea. Las visibles primero. */
    const existing = firmValue.startsWith(NEW_FIRM_PREFIX)
      ? []
      : accounts
          .filter((account) => !firmValue || account.firmId === firmValue)
          .sort((left, right) => Number(left.visible === false) - Number(right.visible === false));
    return [
      /* Crear cuenta solo tiene sentido para un gasto: un cobro sale de una cuenta que ya
         existe. */
      ...(item.kind === "expense" ? [{ label: t("movement.field.createAccount"), value: NEW_ACCOUNT, accent: true }] : []),
      { label: t("movement.field.noAccount"), value: "" },
      ...existing.map((account) => ({ label: account.name, value: account.id })),
    ];
  };

  const matchFor = (item: ReviewRow) => matchedByKey.get(item.row.key);

  const toImport = review ? review.rows.filter((item) => selected.has(item.row.key) && item.amount !== undefined) : [];

  const accountsToCreate = toImport.filter((item) => accountChoice[item.row.key] === NEW_ACCOUNT).length;

  const handleImport = async () => {
    if (!review) return;
    const requests: { movementId: string; firmValue: string; purchasedAt: string }[] = [];
    const items = toImport.map((item) => {
      const id = createUuid();
      const firmValue = firmChoice[item.row.key] || "";
      const account = accountChoice[item.row.key] || "";
      if (account === NEW_ACCOUNT) requests.push({ movementId: id, firmValue, purchasedAt: item.row.date });
      const newFirmName = firmValue.startsWith(NEW_FIRM_PREFIX) ? firmValue.slice(NEW_FIRM_PREFIX.length) : undefined;
      const original =
        item.row.currency !== currency ? ` · ${formatMoney(Math.abs(item.row.amount), item.row.currency as Currency)}` : "";
      return {
        id,
        input: {
          date: item.row.date,
          kind: item.kind,
          category: categoryChoice[item.row.key],
          amount: item.amount!,
          firmId: newFirmName ? "" : firmValue,
          /* La cuenta nueva aun no existe: el cargo entra sin cuenta y se enlaza al
             guardarla en el alta que se abre despues. */
          accountId: account === NEW_ACCOUNT ? "" : account,
          /* De donde salio y, si se convirtio, el importe original: sin eso "43,86 €" de
             un cargo de 50 $ no se reconoce luego en el extracto. */
          note: `${SOURCE_LABELS[review.source]} · ${item.row.counterparty}${original}`,
        },
        newFirm: newFirmName
          ? { name: newFirmName, type: item.match.kind === "firm" ? item.match.type : "other" }
          : undefined,
      };
    });
    const createdFirmIds = await onImport(items);
    if (!createdFirmIds) return;
    onClose();
    if (requests.length) {
      onRequestAccounts(
        requests.map((request) => ({
          movementId: request.movementId,
          firmId: request.firmValue.startsWith(NEW_FIRM_PREFIX)
            ? createdFirmIds[request.firmValue.slice(NEW_FIRM_PREFIX.length)] || ""
            : request.firmValue,
          purchasedAt: request.purchasedAt,
        })),
      );
    }
  };

  return (
    <Modal
      onClose={onClose}
      subtitle={review ? undefined : t("movement.import.subtitle")}
      title={t("movement.import.title")}
      width="wide"
    >
      {!review && (
        <div className="bank-import-pick">
          <input
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readFile(file);
            }}
            ref={inputRef}
            type="file"
          />
          <div
            className={`bank-import-dropzone ${dragging ? "is-dragging" : ""}`}
            onClick={() => !reading && inputRef.current?.click()}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDrop={handleDrop}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <FileUp size={22} strokeWidth={2} />
            <strong>{reading ? t("movement.import.reading") : t("movement.import.drop")}</strong>
            <span>{t("movement.import.banks")}</span>
          </div>
          <p className="bank-import-privacy">{t("movement.import.privacy")}</p>
          {error && <p className="mutation-message error">{error}</p>}

          {/* Como sacar el CSV: no todo el mundo sabe donde esta el extracto de su banco,
              y sin el fichero esta pantalla no sirve de nada. */}
          <section className="bank-import-guide" aria-labelledby="bank-import-guide-title">
            <div className="bank-import-guide-head">
              <strong id="bank-import-guide-title">{t("movement.import.guide.title")}</strong>
              <div className="bank-import-guide-tabs" role="tablist">
                {(Object.keys(GUIDE_STEPS) as BankSource[]).map((bank) => (
                  <button
                    aria-selected={guideBank === bank}
                    className={guideBank === bank ? "is-active" : ""}
                    key={bank}
                    onClick={() => setGuideBank(bank)}
                    role="tab"
                    type="button"
                  >
                    {SOURCE_LABELS[bank]}
                  </button>
                ))}
              </div>
            </div>
            <ol role="tabpanel">
              {GUIDE_STEPS[guideBank].map((key) => (
                <li key={key}>{t(key as Parameters<typeof t>[0])}</li>
              ))}
            </ol>
            <p className="bank-import-guide-note">{t(`movement.import.guide.${guideBank}Note` as Parameters<typeof t>[0])}</p>
          </section>
        </div>
      )}

      {review && (
        <>
          <p className="bank-import-summary">
            <strong>{SOURCE_LABELS[review.source]}</strong>
            {" · "}
            {t("movement.import.summary").replace("{total}", String(review.total)).replace("{found}", String(review.rows.length))}
            {review.converted && (
              <>
                {" "}
                {t("movement.import.convertedNote").replace("{currency}", currency)}
              </>
            )}
          </p>

          {review.rows.length === 0 ? (
            <p className="mutation-message info">{t("movement.import.nothingFound")}</p>
          ) : (
            <div className="bank-import-list">
              {review.rows.map((item) => {
                const key = item.row.key;
                const match = matchFor(item);
                const categories = item.kind === "income" ? incomeCategories : expenseCategories;
                const isSelected = selected.has(key);
                return (
                  <article className={`bank-import-row ${isSelected ? "is-selected" : ""}`} key={key}>
                    <input
                      aria-label={item.row.counterparty}
                      checked={isSelected}
                      disabled={item.amount === undefined}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      type="checkbox"
                    />
                    <div className="bank-import-row-main">
                      <strong>{item.row.counterparty}</strong>
                      <small>
                        {item.row.date}
                        {match && (
                          <em className="bank-import-flag">
                            {match.exact ? t("movement.import.flagDuplicate") : t("movement.import.flagPossibleDuplicate")}
                          </em>
                        )}
                        {item.reversed && <em className="bank-import-flag">{t("movement.import.flagReversed")}</em>}
                      </small>
                    </div>
                    <div className="bank-import-row-firm">
                      <Select
                        disabled={mutating}
                        onChange={(next) => {
                          setFirmChoice((current) => ({ ...current, [key]: next }));
                          /* La cuenta elegida era de la empresa anterior: se vuelve a proponer. */
                          setAccountChoice((current) => ({
                            ...current,
                            [key]: defaultAccountFor(item, next, categoryChoice[key], new Set()),
                          }));
                        }}
                        options={firmOptionsFor(item)}
                        value={firmChoice[key] || ""}
                      />
                    </div>
                    <div className="bank-import-row-account">
                      <Select
                        disabled={mutating}
                        onChange={(next) => setAccountChoice((current) => ({ ...current, [key]: next }))}
                        options={accountOptionsFor(item)}
                        value={accountChoice[key] || ""}
                      />
                    </div>
                    <div className="bank-import-row-category">
                      <Select
                        disabled={mutating}
                        onChange={(next) => {
                          setCategoryChoice((current) => ({ ...current, [key]: next as MovementCategory }));
                          /* Un reset o una activacion no son una cuenta nueva. */
                          if (next !== "challenge" && accountChoice[key] === NEW_ACCOUNT) {
                            setAccountChoice((current) => ({ ...current, [key]: "" }));
                          }
                        }}
                        options={categories.map((category) => ({ label: categoryLabels[category], value: category }))}
                        value={categoryChoice[key]}
                      />
                    </div>
                    <div className={`bank-import-row-amount ${item.kind}`}>
                      <strong>
                        {item.amount === undefined
                          ? "—"
                          : `${item.kind === "income" ? "+" : "-"}${formatMoney(item.amount, currency)}`}
                      </strong>
                      {item.row.currency !== currency && (
                        <small>{formatMoney(Math.abs(item.row.amount), item.row.currency as Currency)}</small>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {accountsToCreate > 0 && (
            <p className="bank-import-summary">
              {(accountsToCreate === 1 ? t("movement.import.accountsNextOne") : t("movement.import.accountsNext")).replace(
                "{n}",
                String(accountsToCreate),
              )}
            </p>
          )}

          {(error || mutationError) && <p className="mutation-message error">{error || mutationError}</p>}

          <div className="form-action-row">
            <button
              className="ghost-action"
              disabled={mutating}
              onClick={() => {
                setReview(null);
                setError(null);
              }}
              type="button"
            >
              {t("movement.import.otherFile")}
            </button>
            <button
              className="primary-action"
              disabled={!canWrite || mutating || toImport.length === 0}
              onClick={() => void handleImport()}
              type="button"
            >
              <Plus size={17} strokeWidth={2.2} />
              {mutating
                ? t("common.saving")
                : toImport.length === 0
                  ? t("movement.import.confirmNone")
                  : (toImport.length === 1 ? t("movement.import.confirmOne") : t("movement.import.confirm")).replace(
                      "{n}",
                      String(toImport.length),
                    )}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
