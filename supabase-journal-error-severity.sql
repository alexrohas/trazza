-- Severidad explicita de los tipos de error del journal.
--
-- Es ADITIVO a proposito: anade una columna anulable y no toca ninguna existente, asi
-- que la app legada (app.js, la que sirve trazzajournal.com con los usuarios de pago)
-- sigue funcionando igual y ni se entera si no la mira.
--
-- POR QUE HACE FALTA
-- Hasta ahora la severidad no se guardaba en ningun sitio: las dos apps la deducian del
-- color, comparandolo con tres paletas (una por severidad). Al crear un tipo se le
-- asignaba un color de la paleta de su severidad, asi que el color ERA el dato
-- persistido. El efecto secundario es que cambiar el color de un tipo le cambiaba la
-- severidad sin querer, y nadie avisaba.
--
-- EL LEGADO LA RECOGE SOLO, SIN TOCARLO
-- fetchJournalErrorTypes hace .select("*"), asi que la columna nueva le llega; y
-- fromDbJournalErrorType llama a inferJournalErrorSeverity(row), que arranca con:
--     const explicit = normalizeJournalErrorSeverity(type?.severity);
--     if (type?.severity && explicit) return explicit;
-- o sea que si la fila trae severity, la usa tal cual y no deduce nada.
--
-- OJO CON UN DETALLE: journalErrorTypeToDb del legado NO incluye severity en el objeto
-- que escribe, asi que si editas u ocultas un tipo DESDE EL LEGADO, esa fila se guarda
-- sin severidad y la columna vuelve a NULL. No se rompe nada porque entonces se deduce
-- del color otra vez — y por eso los colores que asigna React siguen perteneciendo a las
-- paletas del legado, para que esa vuelta atras siga dando la respuesta correcta.

-- ---------------------------------------------------------------------------
-- 0. ANTES DE NADA: mira que hay. Ejecuta solo esto primero.
-- ---------------------------------------------------------------------------
-- select count(*) as tipos from public.journal_error_types;
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'journal_error_types';

-- ---------------------------------------------------------------------------
-- 1. Columna nueva. Idempotente: se puede reejecutar sin romper nada.
--    Anulable a proposito y sin relleno automatico: una fila sin severidad cae en la
--    deduccion por color, que es exactamente lo que hacen hoy las dos apps. Rellenarla
--    "a lo que salga" seria peor, porque congelaria una deduccion como si fuera un dato.
-- ---------------------------------------------------------------------------
alter table public.journal_error_types
  add column if not exists severity text;

-- ---------------------------------------------------------------------------
-- 2. Restriccion. Los tres valores son los que ya usan las dos apps.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'journal_error_types_severity_check'
  ) then
    alter table public.journal_error_types
      add constraint journal_error_types_severity_check
      check (severity is null or severity in ('minor', 'moderate', 'severe'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Comprobacion final.
-- ---------------------------------------------------------------------------
-- select severity, count(*) from public.journal_error_types group by severity;
-- -- Al principio todo saldra en NULL: se va rellenando segun se editen los tipos
-- -- desde React, que ahora si escribe la severidad que elijas.
