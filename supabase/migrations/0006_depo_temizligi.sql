-- Depo temizliği.
-- Not: Supabase, storage.objects tablosundan doğrudan silmeye izin vermiyor
-- (protect_delete trigger). Bu yüzden fonksiyonlar yalnızca SİLİNECEK DOSYA
-- YOLLARINI döndürür; gerçek silme istemcide Storage API ile yapılır.

-- Süresi dolmuş durumları siler, dosya yollarını döndürür.
create or replace function public.purge_expired_statuses()
returns text[]
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  yollar text[] := '{}';
begin
  select coalesce(array_agg(substring(media_url from '/object/public/media/(.*)$')), '{}')
    into yollar
    from public.statuses
   where expires_at < now() - interval '2 hours'
     and media_url is not null;

  delete from public.statuses where expires_at < now() - interval '2 hours';
  return yollar;
end $$;

grant execute on function public.purge_expired_statuses() to authenticated;

-- Hiçbir mesaja/duruma bağlı olmayan (artık) dosyaların yollarını döndürür.
create or replace function public.purge_orphan_media()
returns text[]
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  yollar text[] := '{}';
begin
  select coalesce(array_agg(o.name), '{}')
    into yollar
    from storage.objects o
   where o.bucket_id = 'media'
     and o.created_at < now() - interval '1 day'
     and not exists (select 1 from public.messages m where m.media_url like '%' || o.name)
     and not exists (select 1 from public.statuses s where s.media_url like '%' || o.name);
  return yollar;
end $$;

grant execute on function public.purge_orphan_media() to authenticated;
