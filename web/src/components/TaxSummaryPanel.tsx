import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { InfoHint } from "./InfoHint";
import { Select } from "./Select";
import { getMovementCategoryLabels } from "./MovementsView";
import { loadEcbRates } from "../lib/fxRates";
import { getAccountName } from "../lib/metrics";
import { buildTaxRows, exportTaxCsv, getMovementYears, summarizeTaxRows, type TaxRow } from "../lib/taxSummary";
import { useT } from "../lib/i18n/context";
import type { Currency, Firm, Movement, TradingAccount } from "../types";

type TaxSummaryPanelProps = {
  accounts: TradingAccount[];
  currency: Currency;
  firms: Firm[];
  /** Todos, sin los filtros del Panel: un año fiscal es el año entero. */
  movements: Movement[];
};

const EUR = "EUR";

function formatEur(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: EUR, maximumFractionDigits: 2, useGrouping: true }).format(value);
}

/**
 * Cobros y gastos por trimestre, en euros, para llevárselo a la gestoría. **Enseña lo que
 * hay, no dice qué hacer con ello**: ni estima cuotas ni decide qué es deducible (ver
 * `lib/taxSummary.ts`).
 */
export function TaxSummaryPanel({ accounts, currency, firms, movements }: TaxSummaryPanelProps) {
  const t = useT();
  const categoryLabels = useMemo(() => getMovementCategoryLabels(t), [t]);
  const years = useMemo(() => getMovementYears(movements), [movements]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rows, setRows] = useState<TaxRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  /* Si no hay movimientos del año en curso, se abre por el último que sí tenga. */
  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0]);
  }, [year, years]);

  const yearMovements = useMemo(
    () => movements.filter((movement) => Number(movement.date.slice(0, 4)) === year),
    [movements, year],
  );

  useEffect(() => {
    let cancelled = false;
    if (!yearMovements.length) {
      setRows([]);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    loadEcbRates(currency, EUR, yearMovements.map((movement) => movement.date))
      .then((rateFor) => {
        if (cancelled) return;
        setRows(buildTaxRows(yearMovements, year, rateFor));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        /* Sin cambio no se inventa ninguno: se dice y ya está. */
        setRows(null);
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currency, year, yearMovements]);

  const summary = useMemo(() => (rows ? summarizeTaxRows(rows, year) : undefined), [rows, year]);
  const firmNameById = useMemo(() => new Map(firms.map((firm) => [firm.id, firm.name])), [firms]);

  const handleExport = () => {
    if (!rows?.length) return;
    exportTaxCsv(rows, year, currency, {
      firm: (movement) => firmNameById.get(movement.firmId) || t("movement.table.generalFirm"),
      account: (movement) => getAccountName(accounts, movement.accountId, t("movement.field.noAccount")),
      category: (movement) => categoryLabels[movement.category],
      income: t("movement.kind.income"),
      expense: t("movement.kind.expense"),
    }, [
      t("tax.csv.date"),
      t("tax.csv.quarter"),
      t("tax.csv.kind"),
      t("tax.csv.category"),
      t("tax.csv.firm"),
      t("tax.csv.account"),
      t("tax.csv.amount"),
      t("tax.csv.currency"),
      t("tax.csv.rate"),
      t("tax.csv.eur"),
      t("tax.csv.gross"),
      t("tax.csv.note"),
    ]);
  };

  return (
    <section className="panel tax-summary-panel">
      <div className="panel-heading">
        <div className="panel-title-row">
          <h2>{t("tax.title")}</h2>
          <InfoHint text={t("tax.hint")} />
        </div>
        <div className="tax-summary-controls">
          <Select
            onChange={(next) => setYear(Number(next))}
            options={(years.length ? years : [year]).map((option) => ({ label: String(option), value: String(option) }))}
            value={String(year)}
          />
          <button className="secondary-action" disabled={!rows?.length} onClick={handleExport} type="button">
            <Download size={16} strokeWidth={2.2} />
            {t("tax.export")}
          </button>
        </div>
      </div>

      {loading && <p className="mutation-message info">{t("tax.loading")}</p>}
      {failed && <p className="mutation-message error">{t("tax.rateError")}</p>}

      {!loading && !failed && summary && summary.totals.movements === 0 && (
        <article className="empty-panel inline-empty">
          <FileSpreadsheet size={22} strokeWidth={2.2} />
          <strong>{t("tax.empty.title")}</strong>
          <span>{t("tax.empty.text")}</span>
        </article>
      )}

      {!loading && !failed && summary && summary.totals.movements > 0 && (
        <>
          <div className="table-scroll">
            <table className="tax-summary-table">
              <thead>
                <tr>
                  <th>{t("tax.table.quarter")}</th>
                  <th className="align-right">{t("tax.table.payouts")}</th>
                  <th className="align-right">{t("tax.table.refunds")}</th>
                  <th className="align-right">{t("tax.table.expenses")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.quarters.map((quarter) => (
                  <tr key={quarter.quarter}>
                    <td data-label={t("tax.table.quarter")}>
                      {t("tax.table.quarterPrefix")}
                      {quarter.quarter}
                      <small>{t(`tax.table.months.q${quarter.quarter}` as Parameters<typeof t>[0])}</small>
                    </td>
                    <td className="align-right amount income" data-label={t("tax.table.payouts")}>
                      {formatEur(quarter.payouts)}
                    </td>
                    <td className="align-right amount income" data-label={t("tax.table.refunds")}>
                      {formatEur(quarter.refunds)}
                    </td>
                    <td className="align-right amount expense" data-label={t("tax.table.expenses")}>
                      {formatEur(quarter.expenses)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  {/* data-label tambien aqui: en movil las tablas se pintan como fichas y
                      cada celda saca su etiqueta del atributo. */}
                  <th>{t("tax.table.total")}</th>
                  <td className="align-right amount income" data-label={t("tax.table.payouts")}>
                    {formatEur(summary.totals.payouts)}
                  </td>
                  <td className="align-right amount income" data-label={t("tax.table.refunds")}>
                    {formatEur(summary.totals.refunds)}
                  </td>
                  <td className="align-right amount expense" data-label={t("tax.table.expenses")}>
                    {formatEur(summary.totals.expenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {summary.missingRate > 0 && (
            <p className="mutation-message info">{t("tax.missingRate").replace("{n}", String(summary.missingRate))}</p>
          )}

          {/* Va debajo de las cifras y siempre, no escondido en una pista: es la mitad de
              la respuesta, y la que evita que esto se lea como un consejo. */}
          <p className="tax-summary-disclaimer">
            {currency === EUR ? t("tax.disclaimerEur") : t("tax.disclaimer").replace("{currency}", currency)}
          </p>
        </>
      )}
    </section>
  );
}
