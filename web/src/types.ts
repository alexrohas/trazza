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
  /* Reglas de cobro (supabase-accounts-payout-rules.sql). Opcionales de verdad, no
     numeros con cero por defecto como las tres de arriba: aqui undefined significa "esta
     firma no tiene esa regla", y un cero diria justo lo contrario — que el limite de
     consistencia es 0% o que hacen falta 0 dias rentables. El motor de reglas
     (lib/accountRules.ts) solo comprueba las que estan puestas. */
  consistencyPct?: number;
  minProfitDays?: number;
  profitDayMin?: number;
  payoutMin?: number;
  /* Opcional (no obligatorio) a proposito: la columna es aditiva en Supabase y una fila
     sin ella se lee como visible, igual que en el legado. No vive en AccountInput —
     se escribe con un update propio (setAccountVisible), no con el alta/edicion normal,
     para que guardar la cuenta desde el formulario no pueda resetear la visibilidad. */
  visible?: boolean;
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
  consistencyPct?: number;
  minProfitDays?: number;
  profitDayMin?: number;
  payoutMin?: number;
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

/* A diferencia de JournalErrorType, sin color: la estrategia es una unica seleccion por
   entrada (no una etiqueta multiple), y el desglose la colorea por signo del P&L (como
   Resultado por empresa), no por identidad — no hace falta que el usuario elija un color
   por estrategia. */
export type JournalStrategy = {
  id: string;
  label: string;
  position: number;
  active: boolean;
};

export type JournalStrategyInput = {
  label: string;
  active?: boolean;
  position?: number;
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
  strategyId?: string;
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
  strategyId?: string;
  operationUrl?: string;
  notes?: string;
  lesson?: string;
};

/* Citas del calendario economico que se siguen. Solo alto impacto ("carpeta roja"), y solo
   EE. UU., que es lo que mueve los indices con los que se opera aqui. Ver data/economicEvents. */
export type EconomicEventType = "fomc" | "cpi" | "nfp" | "pce" | "retailSales" | "ismManufacturing" | "ismServices";

export type EconomicEvent = {
  /** Instante exacto en UTC (ISO): la hora local la pone quien lo pinta. */
  at: string;
  type: EconomicEventType;
};

export type NavigationView =
  | "overview"
  | "firms"
  | "accounts"
  | "movements"
  | "journalDashboard"
  | "journalEntries"
  | "economicEvents"
  | "settings";

export type AppData = {
  firms: Firm[];
  accounts: TradingAccount[];
  movements: Movement[];
  journalEntries: JournalEntry[];
  journalErrorTypes: JournalErrorType[];
  /* Ids de los 8 tipos de error "por defecto" (defaultJournalErrorTypes en
     journalErrors.ts) que el usuario ha borrado de verdad. Sin esto, mergeJournalErrorTypes
     los volveria a sembrar en cada carga aunque no exista fila real para ellos. */
  deletedDefaultErrorTypeIds: string[];
  /* Sin equivalente al array de arriba: las estrategias no traen semillas por defecto
     (no existian en el legado, nada que igualar), asi que no hace falta un tombstone. */
  journalStrategies: JournalStrategy[];
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
