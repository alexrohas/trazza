import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Currency, Movement, TradingAccount } from "../types";
import { formatMoney, getAccountName } from "../lib/metrics";

type MovementsTableProps = {
  movements: Movement[];
  accounts: TradingAccount[];
  currency: Currency;
};

const categoryLabels: Record<Movement["category"], string> = {
  challenge: "Challenge",
  reset: "Reset",
  activation: "Activacion",
  subscription: "Suscripcion",
  platform: "Plataforma",
  commission: "Comision",
  payout: "Payout",
  refund: "Refund",
  other: "Otro",
};

export function MovementsTable({ movements, accounts, currency }: MovementsTableProps) {
  const recentMovements = [...movements].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);

  return (
    <section className="panel table-panel recent-movements-panel">
      <div className="panel-heading">
        <div>
          <h2>Movimientos recientes</h2>
          <p>Ingresos y costes operativos.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cuenta</th>
              <th>Categoria</th>
              <th className="align-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {recentMovements.map((movement) => {
              const Icon = movement.kind === "income" ? ArrowUpRight : ArrowDownLeft;

              return (
                <tr key={movement.id}>
                  <td>{movement.date}</td>
                  <td>{getAccountName(accounts, movement.accountId)}</td>
                  <td>
                    <span className={`movement-badge ${movement.kind}`}>
                      <Icon size={14} strokeWidth={2.4} />
                      {categoryLabels[movement.category]}
                    </span>
                  </td>
                  <td className={`align-right amount ${movement.kind}`}>
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
