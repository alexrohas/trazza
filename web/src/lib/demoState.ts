import { accounts, firms, journalEntries, journalErrorTypes, journalStrategies, movements } from "../data/demoData";
import type { AppData } from "../types";

export const demoData: AppData = {
  firms,
  accounts,
  movements,
  journalEntries,
  journalErrorTypes,
  deletedDefaultErrorTypeIds: [],
  journalStrategies,
};
