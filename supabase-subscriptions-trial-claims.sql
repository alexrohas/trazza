-- Una prueba gratuita por persona, no por cuenta.
--
-- Se ejecuta a mano en el SQL Editor de Supabase. ADITIVO: una tabla nueva, una funcion
-- nueva y la funcion del trigger de alta reescrita con el mismo nombre. No toca
-- subscriptions ni ninguna fila de usuario, y el legado archivado ni se entera.
-- Idempotente: se puede reejecutar sin romper nada.
--
-- EL AGUJERO
-- handle_new_user_subscription() (supabase-subscriptions.sql) regalaba 14 dias a cada
-- fila nueva de auth.users sin mirar nada mas, y la Edge Function delete-account borra la
-- fila de subscriptions y la de auth.users, asi que no quedaba ningun rastro de que ese
-- email ya hubiera tenido prueba. Exportar el JSON desde Ajustes, borrar la cuenta,
-- registrarse otra vez con el mismo email e importar el JSON devolvia una prueba nueva
-- con todos los datos dentro: dos minutos cada 14 dias, indefinidamente.
--
-- EL ARREGLO
-- Cada alta deja una huella del email en trial_claims: el SHA-256 del email normalizado,
-- nunca el email. La tabla no cuelga de auth.users, asi que sobrevive al borrado de la
-- cuenta. Un alta cuyo email ya tiene huella hereda el fin de prueba que tenia en vez de
-- estrenar uno: si borro la cuenta al tercer dia le quedan los once que le quedaban, y si
-- la prueba ya habia acabado la cuenta nace en solo lectura, con el aviso de "Tu prueba
-- gratuita ha terminado". El reloj es del email, no de la cuenta: borrarla ni lo para ni
-- lo reinicia.
--
-- LA NORMALIZACION NO ES UN EXTRA
-- 53 de los 55 usuarios usan Gmail (medido el 22 de septiembre de 2026), y Gmail entrega
-- en el mismo buzon alex@, a.lex@ y alex+2@. Sin normalizar, el arreglo se saltaba con un
-- punto. Se quita la subdireccion (+loquesea) en cualquier dominio, porque la aceptan
-- Gmail, Outlook, iCloud, Proton, Fastmail..., y los puntos solo en Gmail, que es el unico
-- que los ignora. Con un email distinto de verdad si hay prueba nueva: eso no lo evita
-- nada que no sea pedir tarjeta para empezar la prueba.
--
-- LEGAL
-- La huella se queda despues de borrar la cuenta, y un hash de un email sigue siendo dato
-- personal (seudonimizado, no anonimo). Va declarado en web/public/legal.html, en
-- "Conservacion" y en "Eliminacion y exportacion": se guarda solo para esto, por interes
-- legitimo en evitar el abuso de la prueba, y no permite recuperar el email.

-- ---------------------------------------------------------------------------
-- 1. La huella del email. NULL si no hay email (altas por telefono o anonimas, que hoy
--    no existen): esas siguen recibiendo su prueba como siempre.
-- ---------------------------------------------------------------------------
create or replace function public.trial_email_hash(email text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  normalized text := lower(btrim(email));
  local_part text := substring(normalized from '^(.+)@[^@]+$');
  domain_part text := substring(normalized from '@([^@]+)$');
begin
  if local_part is null or domain_part is null then
    return null;
  end if;

  -- alex+trazza2@ llega al buzon de alex@. Si delante del "+" no queda nada, se deja
  -- como estaba: "+x@" y "+y@" no son la misma persona.
  if split_part(local_part, '+', 1) <> '' then
    local_part := split_part(local_part, '+', 1);
  end if;

  -- Gmail ignora los puntos, y googlemail.com es el mismo servicio con otro nombre.
  if domain_part in ('gmail.com', 'googlemail.com') then
    local_part := replace(local_part, '.', '');
    domain_part := 'gmail.com';
  end if;

  return encode(sha256(convert_to(local_part || '@' || domain_part, 'UTF8')), 'hex');
end;
$$;

-- Solo la usan el trigger y el backfill, que corren como su dueno. Supabase da EXECUTE a
-- anon y authenticated en cada funcion nueva de public, y eso la deja llamable desde la
-- API: no revela nada, pero tampoco hay motivo para que este ahi.
revoke execute on function public.trial_email_hash(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Las huellas. Sin FK a auth.users a proposito: es justo lo que las hace sobrevivir
--    al borrado de la cuenta.
-- ---------------------------------------------------------------------------
create table if not exists public.trial_claims (
  email_hash text primary key,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Nadie la lee ni la escribe desde la app: anon y authenticated no tienen permisos, y
-- sin politicas RLS tampoco podrian aunque los tuvieran. El trigger de alta es security
-- definer y su dueno (postgres) tiene BYPASSRLS, que es lo mismo que ya le deja escribir
-- en subscriptions.
alter table public.trial_claims enable row level security;
alter table public.trial_claims force row level security;
revoke all on table public.trial_claims from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. El trigger de alta, reescrito. Mismo nombre y misma firma, asi que el trigger
--    on_auth_user_created_subscription sigue apuntando aqui sin recrearlo.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh_trial_end constant timestamptz := now() + interval '14 days';
  trial_end timestamptz;
  claim text;
begin
  -- Si algo de la huella falla, el alta sigue con su prueba de siempre. Un error en un
  -- trigger de auth.users tumba el registro entero ("Database error saving new user"), y
  -- dejar sin cuenta a alguien de verdad es peor que regalar una prueba de mas: el mismo
  -- fail-open que canMutateData en useSubscription.
  begin
    claim := public.trial_email_hash(new.email);
    if claim is not null then
      -- Si el email ya tenia huella, no se toca: manda la fecha de la primera prueba.
      insert into public.trial_claims (email_hash, trial_ends_at)
      values (claim, fresh_trial_end)
      on conflict (email_hash) do nothing;

      select c.trial_ends_at into trial_end
      from public.trial_claims c
      where c.email_hash = claim;
    end if;
  exception when others then
    raise warning 'trial_claims: se da prueba nueva a % sin comprobar la huella (%)', new.id, sqlerrm;
    trial_end := null;
  end;

  -- El coalesce no es decorativo: para isSubscriptionAccessActive, un trialing con
  -- trial_ends_at a NULL es acceso sin limite, asi que ningun camino puede dejarlo vacio.
  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (new.id, 'trialing', coalesce(trial_end, fresh_trial_end))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Las cuentas que ya existen dejan tambien su huella, con el fin de prueba que tienen
--    hoy: si no, cualquiera de las de ahora podria borrar y volver para estrenar otra.
--    Si dos cuentas vivas comparten email normalizado (hoy ninguna), manda la prueba que
--    acaba antes. Una fila sin fin de prueba (hay una lifetime asi) cuenta como acabada.
-- ---------------------------------------------------------------------------
insert into public.trial_claims (email_hash, trial_ends_at)
select public.trial_email_hash(u.email), min(coalesce(s.trial_ends_at, now()))
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where public.trial_email_hash(u.email) is not null
group by 1
on conflict (email_hash) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Comprobacion: ninguna cuenta viva sin huella, y ninguna huella de mas.
-- ---------------------------------------------------------------------------
-- select
--   (select count(*) from public.trial_claims) as huellas,
--   (select count(distinct public.trial_email_hash(email)) from auth.users) as emails_distintos,
--   (select count(*) from auth.users u
--     where not exists (select 1 from public.trial_claims c
--                       where c.email_hash = public.trial_email_hash(u.email))) as cuentas_sin_huella;
