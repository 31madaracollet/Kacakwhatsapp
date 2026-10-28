-- Depo temizliği: silinen mesaj/durum dosyaları Storage'dan da kalksın.

-- Yönetici, başkasının yüklediği dosyayı silebilsin (Storage RLS'i sahibi olmayanı engelliyor).
create or replace function public.delete_media_admin(p_path text)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if not public.is_app_admin() then
    return false;
  end if;
  if p_path is null or p_path = '' then
    return false;
  end if;
  delete from storage.objects where bucket_id = 'media' and name = p_path;
  return true;
end $$;

grant execute on function public.delete_media_admin(text) to authenticated;

-- Süresi dolmuş durumları ve dosyalarını temizle (24 saat + 2 saat tolerans).
create or replace function public.purge_expired_statuses()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  rec record;
  silinen integer := 0;
begin
  for rec in
    select id, media_url
      from public.statuses
     where expires_at < now() - interval '2 hours'
  loop
    if rec.media_url is not null then
      delete from storage.objects
       where bucket_id = 'media'
         and name = substring(rec.media_url from '/object/public/media/(.*)$');
    end if;
  end loop;

  delete from public.statuses where expires_at < now() - interval '2 hours';
  get diagnostics silinen = row_count;
  return silinen;
end $$;

grant execute on function public.purge_expired_statuses() to authenticated;

-- Hiçbir mesaja/duruma bağlı olmayan (artık) dosyaları temizle: depo şişmesin.
create or replace function public.purge_orphan_media()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  silinen integer := 0;
begin
  delete from storage.objects o
   where o.bucket_id = 'media'
     and o.created_at < now() - interval '1 day'
     and not exists (select 1 from public.messages m where m.media_url like '%' || o.name)
     and not exists (select 1 from public.statuses s where s.media_url like '%' || o.name);
  get diagnostics silinen = row_count;
  return silinen;
end $$;

grant execute on function public.purge_orphan_media() to authenticated;
