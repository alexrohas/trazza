import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Currency, Movement, TradingAccount } from "../types";
import { formatMoney, getAccountName } from "../lib/metrics";
import { useT } from "../lib/i18n/context";
import { getMovementCategoryLabels } from "./MovementsView";

type MovementsTableProps = {
  movements: Movement[];
  accounts: TradingAccount[];
  currency: Currency;
};

export function MovementsTable({ movements, accounts, currency }: MovementsTableProps) {
  const t = useT();
  const categoryLabels = getMovementCategoryLabels(t);
  const recentMovements = [...movements].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);

  return (
    <section className="panel table-panel recent-movements-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("movement.recent.title")}</h2>
          <p>{t("movement.recent.subtitle")}</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("movement.table.date")}</th>
              <th>{t("movement.table.account")}</th>
              <th>{t("movement.table.category")}</th>
              <th className="align-right">{t("movement.table.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {recentMovements.map((movement) => {
              const Icon = movement.kind === "income" ? ArrowUpRight : ArrowDownLeft;

              return (
                <tr key={movement.id}>
                  <td data-label={t("movement.table.date")}>{movement.date}</td>
                  <td data-label={t("movement.table.account")}>{getAccountName(accounts, movement.accountId)}</td>
                  <td data-label={t("movement.table.category")}>
                    <span className={`movement-badge ${movement.kind}`}>
                      <Icon size={14} strokeWidth={2.4} />
                      {categoryLabels[movement.category]}
                    </span>
                  </td>
                  <td className={`align-right amount ${movement.kind}`} data-label={t("movement.table.amount")}>
                    {movement.kind === "income" ? "+" : "-"}
                    {formatMoney(movement.amount, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
