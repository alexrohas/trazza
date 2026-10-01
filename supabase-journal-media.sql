-- Capturas del Journal en Supabase Storage.
--
-- Se ejecuta a mano en el SQL Editor de Supabase. Aditivo e idempotente: crea una columna
-- anulable, un bucket y cuatro politicas, y no toca ninguna fila.
--
-- EL PROBLEMA
-- Cada captura viajaba en base64 dentro de journal_entries.operation_url (unos 77 kB de
-- media, el 72 % de las entradas tiene una), y la app recarga todas las entradas despues
-- de cada guardado: el usuario con mas capturas se descargaba 6,4 MB cada vez que guardaba
-- algo, y la tabla ya pesaba 27 MB de los 500 del plan gratuito.
--
-- EL ARREGLO
-- La imagen pasa a un bucket privado y la fila guarda solo su ruta en media_path. La app
-- firma las rutas al cargar (una sola peticion para todas) y migra sola las capturas
-- antiguas de cada usuario la primera vez que entra con la version nueva
-- (migrateInlineJournalMedia en web/src/lib/db.ts). operation_url se queda para los
-- enlaces externos y para las filas que aun no se han migrado. Detalle en
-- web/src/lib/journalMedia.ts.
--
-- Rutas: <user_id>/<fichero>. La primera carpeta es el usuario, y es lo unico que miran
-- las politicas para saber de quien es un fichero.
--
-- Escribir (subir, sobrescribir, borrar) exige ademas can_write_data(), igual que las
-- tablas de datos (supabase-rls-subscription-writes.sql): con la prueba caducada se ven
-- las capturas pero no se suben. delete-account usa service_role y borra la carpeta
-- entera sin pasar por aqui.
--
-- OJO con la app de legado (legacy/): lee operation_url y no sabe nada de media_path, asi
-- que las entradas migradas se ven alli sin captura. Esta archivada y no se sirve.

alter table public.journal_entries add column if not exists media_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'journal-media',
  'journal-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "journal_media_select_own" on storage.objects;
drop policy if exists "journal_media_insert_own" on storage.objects;
drop policy if exists "journal_media_update_own" on storage.objects;
drop policy if exists "journal_media_delete_own" on storage.objects;

create policy "journal_media_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "journal_media_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_write_data()
  );

-- upsert necesita UPDATE ademas de INSERT y SELECT: la migracion de las capturas antiguas
-- usa una ruta fija por entrada para que repetirla sobrescriba en vez de duplicar.
create policy "journal_media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_write_data()
  );

create policy "journal_media_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_write_data()
  );
