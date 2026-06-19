import type { Currency, JournalEntry, TradingAccount } from "../types";
import { formatAccountSize, formatMoney, formatPercent, signedTone } from "../lib/metrics";

type AccountHealthProps = {
  accounts: TradingAccount[];
  entries: JournalEntry[];
  currency: Currency;
};

export function AccountHealth({ accounts, entries, currency }: AccountHealthProps) {
  return (
    <section className="panel account-health-panel">
      <div className="panel-heading">
        <div>
          <h2>Estado de cuentas</h2>
          <p>Balance, objetivo y drawdown por cuenta.</p>
        </div>
      </div>
      <div className="account-health-list">
        {accounts.map((account) => {
          const pnl = entries
            .filter((entry) => entry.accountId === account.id)
            .reduce((total, entry) => total + entry.pnl, 0);
          const targetProgress = account.phaseTarget > 0 ? Math.max(0, Math.min(1, pnl / account.phaseTarget)) : 0;
          const drawdownUsed = pnl < 0 && account.maxDrawdown > 0 ? Math.min(1, Math.abs(pnl) / account.maxDrawdown) : 0;

          return (
            <article className="account-row" key={account.id}>
              <div className="account-row-main">
                <span className={`status-dot ${account.status}`} />
                <div>
                  <strong>{account.name}</strong>
                  <small>{formatAccountSize(account, currency)} nominal</small>
                </div>
              </div>
              <div className="account-row-metric">
                <span>Resultado</span>
                <strong className={signedTone(pnl)}>{formatMoney(pnl, currency)}</strong>
              </div>
              <div className="progress-block">
                <div className="progress-copy">
                  <span>Objetivo</span>
                  <strong>{formatPercent(targetProgress)}</strong>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${targetProgress * 100}%` }} />
                </div>
              </div>
              <div className="progress-block danger">
                <div className="progress-copy">
                  <span>Drawdown</span>
                  <strong>{formatPercent(drawdownUsed)}</strong>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${drawdownUsed * 100}%` }} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
