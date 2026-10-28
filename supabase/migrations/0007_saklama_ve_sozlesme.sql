-- 0007 — mesaj saklama süresi (3 gün) + hüküm ve koşullar onayı
-- Canlı projede (szhpjbuuiltkqhhgmphm) uygulandı; bu dosya şemanın kaydı içindir.

-- ---------------------------------------------------------------- sözleşme
alter table public.profiles add column if not exists sozlesme_surumu text;
alter table public.profiles add column if not exists sozlesme_tarihi timestamptz;

-- onayın tek yolu RPC'dir (arayüz bu fonksiyonu çağırır); kolonlar normal profil
-- güncellemesiyle de yazılabilir, bu yüzden ek bir kısıt koymuyoruz.

create or replace function public.sozlesme_kabul(surum text)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  an timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  update public.profiles
     set sozlesme_surumu = surum,
         sozlesme_tarihi = an
   where id = auth.uid();
  return an;
end $function$;

grant execute on function public.sozlesme_kabul(text) to authenticated;

-- kayıt anında onay: signUp metadata'sındaki sürüm profile yazılır
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uname text;
  surum text := nullif(new.raw_user_meta_data->>'sozlesme_surumu', '');
begin
  uname := public.benzersiz_kullanici_adi(new.email, new.id, new.raw_user_meta_data->>'username');
  insert into public.profiles (id, username, display_name, sozlesme_surumu, sozlesme_tarihi)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), uname),
    surum,
    case when surum is null then null else now() end
  )
  on conflict (id) do update
    set sozlesme_surumu = coalesce(public.profiles.sozlesme_surumu, excluded.sozlesme_surumu),
        sozlesme_tarihi = coalesce(public.profiles.sozlesme_tarihi, excluded.sozlesme_tarihi);
  return new;
end $function$;

-- ------------------------------------------------- mesaj saklama (3 gün)
create or replace function public.purge_expired_messages()
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  urller text[] := '{}';
  sinir timestamptz := now() - interval '3 days';
begin
  select coalesce(array_agg(media_url), '{}')
    into urller
    from public.messages
   where created_at < sinir
     and media_url is not null;
  delete from public.messages where created_at < sinir;
  return urller;
end $function$;

grant execute on function public.purge_expired_messages() to authenticated;

-- durum temizliği artık dosya adreslerini döndürür (R2 + Supabase ayrımı istemcide)
create or replace function public.purge_expired_statuses()
returns text[]
language plpgsql
security definer
set search_path to 'public', 'storage'
as $function$
declare
  urller text[] := '{}';
begin
  select coalesce(array_agg(media_url), '{}')
    into urller
    from public.statuses
   where expires_at < now() - interval '2 hours'
     and media_url is not null;
  delete from public.statuses where expires_at < now() - interval '2 hours';
  return urller;
end $function$;

grant execute on function public.purge_expired_statuses() to authenticated;
