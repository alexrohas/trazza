import { useCallback, useEffect, useState } from "react";
import { demoData } from "../lib/demoState";
import {
  createCloudAccount,
  createCloudFirm,
  createCloudJournalEntry,
  createCloudMovement,
  deleteCloudAccount,
  deleteCloudFirm,
  deleteCloudJournalEntry,
  deleteCloudMovement,
  loadCloudData,
  replaceCloudData,
  setCloudJournalErrorTypeActive,
  updateCloudAccount,
  updateCloudFirm,
  updateCloudJournalEntry,
  updateCloudMovement,
  upsertCloudJournalErrorType,
} from "../lib/db";
import { supabaseClient } from "../lib/supabase";
import type { AccountInput, AppData, DataMode, FirmInput, JournalEntryInput, JournalErrorTypeInput, MovementInput, TradingAccount } from "../types";

type DataStatus = "demo" | "idle" | "loading" | "ready" | "error";

export function useTrazzaData(userId: string | undefined, enabled: boolean) {
  const [data, setData] = useState<AppData>(demoData);
  const [status, setStatus] = useState<DataStatus>(enabled ? "loading" : "demo");
  const [mode, setMode] = useState<DataMode>("demo");
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !userId || !supabaseClient) {
      setData(demoData);
      setMode("demo");
      setStatus("demo");
      setError(null);
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const cloudData = await loadCloudData(supabaseClient, userId);
      setData(cloudData);
      setMode("cloud");
      setStatus("ready");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudieron cargar los datos.";
      setError(message);
      setData(demoData);
      setMode("demo");
      setStatus("error");
    }
  }, [enabled, userId]);

  const saveFirm = useCallback(
    async (input: FirmInput, firmId?: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para guardar empresas reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        if (firmId) {
          await updateCloudFirm(supabaseClient, userId, firmId, input);
        } else {
          await createCloudFirm(supabaseClient, userId, input);
        }
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo guardar la empresa.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const deleteFirm = useCallback(
    async (firmId: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para eliminar empresas reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        await deleteCloudFirm(supabaseClient, userId, firmId);
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo eliminar la empresa.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  /* Devuelve la cuenta guardada (no solo si fue bien) porque Movimientos la necesita:
     al crear una cuenta al vuelo desde el formulario de un gasto, hace falta el id
     nuevo para enlazar el movimiento a ella en el mismo guardado. */
  const saveAccount = useCallback(
    async (input: AccountInput, accountId?: string): Promise<TradingAccount | false> => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para guardar cuentas reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        const account = accountId
          ? await updateCloudAccount(supabaseClient, userId, accountId, input)
          : await createCloudAccount(supabaseClient, userId, input);
        await reload();
        return account;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo guardar la cuenta.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const deleteAccount = useCallback(
    async (accountId: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para eliminar cuentas reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        await deleteCloudAccount(supabaseClient, userId, accountId);
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo eliminar la cuenta.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const saveMovement = useCallback(
    async (input: MovementInput, movementId?: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para guardar movimientos reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        if (movementId) {
          await updateCloudMovement(supabaseClient, userId, movementId, input);
        } else {
          await createCloudMovement(supabaseClient, userId, input);
        }
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo guardar el movimiento.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const deleteMovement = useCallback(
    async (movementId: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para eliminar movimientos reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        await deleteCloudMovement(supabaseClient, userId, movementId);
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo eliminar el movimiento.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const saveJournalEntry = useCallback(
    async (input: JournalEntryInput, entryId?: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para guardar entradas reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        if (entryId) {
          await updateCloudJournalEntry(supabaseClient, userId, entryId, input);
        } else {
          await createCloudJournalEntry(supabaseClient, userId, input);
        }
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo guardar la entrada.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const deleteJournalEntry = useCallback(
    async (entryId: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para eliminar entradas reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        await deleteCloudJournalEntry(supabaseClient, userId, entryId);
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo eliminar la entrada.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const saveJournalErrorType = useCallback(
    async (input: JournalErrorTypeInput, typeId?: string) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para guardar tipos de error reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        await upsertCloudJournalErrorType(supabaseClient, userId, input, typeId);
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo guardar el tipo de error.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const setJournalErrorTypeActive = useCallback(
    async (typeId: string, active: boolean) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para actualizar tipos de error reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        await setCloudJournalErrorTypeActive(supabaseClient, userId, typeId, active);
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo actualizar el tipo de error.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  const importData = useCallback(
    async (imported: AppData) => {
      if (!enabled || !userId || !supabaseClient) {
        setMutationError("Conecta Supabase para importar datos reales.");
        return false;
      }

      setMutating(true);
      setMutationError(null);

      try {
        await replaceCloudData(supabaseClient, userId, imported);
        await reload();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudieron importar los datos.";
        setMutationError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [enabled, reload, userId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    deleteAccount,
    deleteFirm,
    deleteJournalEntry,
    deleteMovement,
    error,
    importData,
    mode,
    mutationError,
    mutating,
    reload,
    saveAccount,
    saveFirm,
    saveJournalErrorType,
    saveJournalEntry,
    saveMovement,
    setJournalErrorTypeActive,
    status,
  };
}
