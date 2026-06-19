import type { Currency, JournalEntry, TradingAccount } from "../types";
import { formatDisciplineScore, formatMoney, getAccountName, signedTone } from "../lib/metrics";

type JournalPanelProps = {
  entries: JournalEntry[];
  accounts: TradingAccount[];
  currency: Currency;
  compact?: boolean;
};

const directionLabels: Record<JournalEntry["direction"], string> = {
  long: "Long",
  short: "Short",
  none: "Sin direccion",
};

export function JournalPanel({ entries, accounts, currency, compact = false }: JournalPanelProps) {
  const visibleEntries = compact ? entries.slice(0, 4) : entries;

  return (
    <section className="panel journal-panel">
      <div className="panel-heading">
        <div>
          <h2>Journal</h2>
          <p>{entries.length} entradas registradas en el periodo.</p>
        </div>
      </div>
      <div className="journal-list">
        {visibleEntries.map((entry) => (
          <article className="journal-row" key={entry.id}>
            <div>
              <div className="journal-row-topline">
                <strong>{entry.symbol}</strong>
                <span>{directionLabels[entry.direction]}</span>
              </div>
              <small>
                {entry.date} - {getAccountName(accounts, entry.accountId)}
              </small>
              {!compact && <p>{entry.notes}</p>}
            </div>
            <div className="journal-score">
              <strong className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</strong>
              <span>{entry.rMultiple ? `${entry.rMultiple.toFixed(1)}R` : `Disc. ${formatDisciplineScore(entry.discipline)}`}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
