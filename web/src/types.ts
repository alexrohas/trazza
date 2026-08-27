export type Currency = "EUR" | "USD";

export type FirmType = "futures" | "forex" | "crypto" | "other";

export type Firm = {
  id: string;
  name: string;
  type: FirmType;
  notes?: string;
};

export type FirmInput = {
  name: string;
  type: FirmType;
  notes?: string;
};

export type AccountStatus = "active" | "evaluation" | "passed" | "funded" | "failed" | "closed";

export type AccountKind = "challenge" | "funded" | "own";

export type DrawdownType = "static" | "trailing";

export type TradingAccount = {
  id: string;
  firmId: string;
  name: string;
  status: AccountStatus;
  kind: AccountKind;
  drawdownType: DrawdownType;
  parentAccountId?: string;
  size: number;
  sizeLabel?: string;
  purchasedAt: string;
  phaseTarget: number;
  maxDrawdown: number;
  dailyDrawdown: number;
};

export type AccountInput = {
  firmId: string;
  name: string;
  status: AccountStatus;
  kind: AccountKind;
  drawdownType: DrawdownType;
  parentAccountId?: string;
  size: string;
  purchasedAt?: string;
  phaseTarget?: number;
  maxDrawdown?: number;
  dailyDrawdown?: number;
};

export type MovementKind = "expense" | "income";

export type MovementCategory =
  | "challenge"
  | "reset"
  | "activation"
  | "subscription"
  | "platform"
  | "commission"
  | "payout"
  | "refund"
  | "other";

export type Movement = {
  id: string;
  date: string;
  kind: MovementKind;
  category: MovementCategory;
  amount: number;
  payoutGrossAmount?: number;
  payoutProfitSplit?: number;
  firmId: string;
  accountId?: string;
  note?: string;
};

export type MovementInput = {
  date: string;
  kind: MovementKind;
  category: MovementCategory;
  amount: number;
  payoutGrossAmount?: number;
  payoutProfitSplit?: number;
  firmId: string;
  accountId?: string;
  note?: string;
};

export type JournalDirection = "long" | "short" | "none";
export type JournalTradingSession = "asia" | "london" | "newYork" | "londonNewYork" | "other";
export type JournalSessionType = "trading-day" | "evaluation" | "funded" | "payout-day" | "news-day" | "review" | "other";
export type JournalResult = "good" | "neutral" | "bad";
export type JournalEmotion = "calm" | "focused" | "anxious" | "impatient" | "fomo" | "revenge" | "tired" | "other";
export type JournalErrorSeverity = "minor" | "moderate" | "severe";

export type JournalErrorType = {
  id: string;
  label: string;
  color: string;
  position: number;
  active: boolean;
  /* Opcional porque la columna es anulable: una fila sin severidad cae en la deduccion
     por color, que es lo que hacian las dos apps antes de que existiera la columna. */
  severity?: JournalErrorSeverity;
};

export type JournalErrorTypeInput = {
  label: string;
  color: string;
  active?: boolean;
  position?: number;
  severity?: JournalErrorSeverity;
};

export type JournalEntry = {
  id: string;
  date: string;
  firmId?: string;
  accountId: string;
  symbol: string;
  direction: JournalDirection;
  pnl: number;
  rMultiple: number;
  discipline: number;
  emotion: JournalEmotion;
  errors?: string[];
  operationUrl?: string;
  result?: JournalResult;
  sessionType?: JournalSessionType;
  tradingSession?: JournalTradingSession;
  notes: string;
  lesson?: string;
};

export type JournalEntryInput = {
  date: string;
  firmId?: string;
  accountId?: string;
  symbol: string;
  direction: JournalDirection;
  tradingSession: JournalTradingSession;
  sessionType: JournalSessionType;
  result: JournalResult;
  emotion: JournalEmotion;
  discipline: number;
  pnl: number;
  errors: string[];
  operationUrl?: string;
  notes?: string;
  lesson?: string;
};

export type NavigationView =
  | "overview"
  | "firms"
  | "accounts"
  | "movements"
  | "journalDashboard"
  | "journalEntries"
  | "settings";

export type AppData = {
  firms: Firm[];
  accounts: TradingAccount[];
  movements: Movement[];
  journalEntries: JournalEntry[];
  journalErrorTypes: JournalErrorType[];
};

export type DataMode = "cloud" | "demo";

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  currency: Currency;
};

export type UserProfileInput = {
  displayName: string;
  email: string;
  currency: Currency;
};

export type CapitalPoint = {
  date: string;
  value: number;
};

export type DashboardModel = {
  expenses: number;
  income: number;
  journalPnl: number;
  net: number;
  roi: number;
  activeAccounts: number;
  winRate: number;
  profitFactor: number;
  averageDiscipline: number;
  curve: CapitalPoint[];
  scopedMovements: Movement[];
  scopedJournalEntries: JournalEntry[];
};
