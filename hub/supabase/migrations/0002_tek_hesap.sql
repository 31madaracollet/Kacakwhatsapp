-- =====================================================================
-- 0002 — Tek hesap: hesaplar her uygulamada birlikte açılır/kapanır
--
-- Kural:
--   * Hub'da hesap açılınca  → ZapChat profili + tüm açık uygulamalara erişim
--   * Başka uygulamada açılan hesap → hub profili olarak da düşer (admin görür)
--   * Hub'da hesap kapatılınca → Supabase Auth'ta banlanır; hiçbir uygulamaya giremez
--   * Hub'da hesap açılınca   → ban kalkar, tüm açık uygulamalara erişim verilir
-- =====================================================================

-- 1) benzersiz ZapChat kullanıcı adı (profiles.username zorunlu ve tekil)
create or replace function public.hub_benzersiz_kullanici_adi(p_email text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  temel text;
  aday  text;
  n     int := 0;
begin
  temel := lower(regexp_replace(split_part(coalesce(p_email,''),'@',1), '[^a-zA-Z0-9_]', '', 'g'));
  if temel is null or length(temel) < 3 then
    temel := 'kullanici' || substr(replace(p_id::text,'-',''),1,6);
  end if;
  temel := left(temel, 24);
  aday  := temel;
  while exists (select 1 from public.profiles where username = aday) loop
    n := n + 1;
    aday := temel || n::text;
  end loop;
  return aday;
end $$;

-- 2) yeni hesap: hub + ZapChat + tüm açık uygulamalara erişim
create or replace function public.hub_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ad text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
begin
  insert into public.hub_profiles (id, email, full_name)
  values (new.id, new.email, v_ad)
  on conflict (id) do nothing;

  if not exists (select 1 from public.profiles p where p.id = new.id) then
    insert into public.profiles (id, username, display_name, about)
    values (new.id, public.hub_benzersiz_kullanici_adi(new.email, new.id), v_ad, '')
    on conflict (id) do nothing;
  end if;

  insert into public.hub_access (user_id, app_slug)
  select new.id, a.slug from public.hub_apps a where a.is_active
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists hub_on_auth_user on auth.users;
create trigger hub_on_auth_user
  after insert on auth.users
  for each row execute function public.hub_new_user();

-- ZapChat'ın kendi trigger'ı çakışmasın (idempotent)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;
  uname := public.hub_benzersiz_kullanici_adi(new.email, new.id);
  insert into public.profiles (id, username, display_name)
  values (new.id, uname,
          coalesce(new.raw_user_meta_data->>'display_name',
                   new.raw_user_meta_data->>'full_name', uname))
  on conflict (id) do nothing;
  return new;
end $$;

-- 3) açık/kapalı durumu tüm uygulamalara yayılsın
create or replace function public.hub_sync_active()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active is not distinct from old.is_active then
    return new;
  end if;

  if new.is_active then
    update auth.users set banned_until = null
     where id = new.id and banned_until is not null;
    insert into public.hub_access (user_id, app_slug)
    select new.id, a.slug from public.hub_apps a where a.is_active
    on conflict do nothing;
  else
    update auth.users set banned_until = now() + interval '100 years'
     where id = new.id;
    delete from auth.refresh_tokens where user_id = new.id::text;
  end if;
  return new;
end $$;

drop trigger if exists hub_sync_active_trg on public.hub_profiles;
create trigger hub_sync_active_trg
  after update on public.hub_profiles
  for each row execute function public.hub_sync_active();

-- 4) hesap silinince uygulama profilleri de temizlensin
create or replace function public.hub_delete_user_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end $$;

drop trigger if exists hub_delete_cleanup_trg on public.hub_profiles;
create trigger hub_delete_cleanup_trg
  after delete on public.hub_profiles
  for each row execute function public.hub_delete_user_cleanup();
