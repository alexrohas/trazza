-- Visibilidad de cuentas en los selectores.
--
-- Se ejecuta a mano en el SQL Editor de Supabase y hay que hacerlo ANTES de desplegar el
-- app.js que la usa: hasta que exista la columna, el boton de ocultar avisa de que falta
-- este script en vez de funcionar.
--
-- Es ADITIVA y con default, asi que no rompe a nadie mientras no se despliegue: quien no
-- mira la columna (el React de web/, que comparte estas mismas tablas) sigue leyendo y
-- escribiendo exactamente lo mismo que hoy. El app.js legado tampoco la escribe al
-- guardar una cuenta desde el formulario — solo la toca el boton de ocultar/mostrar —
-- asi que un upsert del React sobre una cuenta oculta la deja oculta.
--
-- Que resuelve: un journal con anos de historial acumula decenas de cuentas muertas
-- (challenges fallados, resets) y todas salian en cada desplegable de cuenta. visible
-- las saca de los selectores SIN tocar los datos: la cuenta sigue existiendo, sigue
-- sumando en el panel, y sus movimientos y entradas de journal se quedan como estan.
-- Ocultar no es archivar ni borrar, es solo dejar de ofrecerla al escribir.

-- ---------------------------------------------------------------------------
-- 0. ANTES DE NADA: mira cuantas cuentas hay por usuario, para saber que esperar
--    despues (todas tienen que quedar visibles).
-- ---------------------------------------------------------------------------
-- select count(*) as cuentas, count(distinct user_id) as usuarios from public.accounts;

-- ---------------------------------------------------------------------------
-- 1. Columna nueva. Idempotente: se puede reejecutar sin romper nada.
--    not null + default true para que todas las cuentas que ya existen queden visibles
--    y el codigo no tenga que distinguir null de true.
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists visible boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Comprobacion final. Lo esperado: todas visibles y ninguna sin valor.
-- ---------------------------------------------------------------------------
-- select visible, count(*) from public.accounts group by visible order by 1;
-- select count(*) as sin_visibilidad from public.accounts where visible is null;  -- debe dar 0
