-- =====================================================================
-- HappyProjects — hub şeması (tek hesap / SSO merkezi)
-- Tablolar public şemasında hub_ önekiyle durur (Supabase REST uyumu için).
-- =====================================================================

create table if not exists public.hub_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  avatar_url text,
  role text not null default 'user' check (role in ('admin','user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table if not exists public.hub_apps (
  slug text primary key,
  name text not null,
  description text default '',
  url text,
  emoji text default '🚀',
  color text default '#00a884',
  category text default 'Uygulama',
  sort int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hub_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null references public.hub_apps(slug) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, app_slug)
);

create table if not exists public.hub_activity (
  id bigserial primary key,
  user_id uuid,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.hub_profiles enable row level security;
alter table public.hub_apps enable row level security;
alter table public.hub_access enable row level security;
alter table public.hub_activity enable row level security;

grant select, insert, update, delete
  on public.hub_profiles, public.hub_apps, public.hub_access, public.hub_activity
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ------------------------------------------------------------------ admin?
create or replace function public.hub_is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.hub_profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active
  );
$$;

-- ------------------------------------------------------------------- RLS
drop policy if exists hub_profiles_self on public.hub_profiles;
create policy hub_profiles_self on public.hub_profiles
  for select to authenticated using (id = auth.uid() or public.hub_is_admin());

drop policy if exists hub_profiles_upd on public.hub_profiles;
create policy hub_profiles_upd on public.hub_profiles
  for update to authenticated
  using (id = auth.uid() or public.hub_is_admin())
  with check (id = auth.uid() or public.hub_is_admin());

drop policy if exists hub_apps_read on public.hub_apps;
create policy hub_apps_read on public.hub_apps for select to authenticated using (true);

drop policy if exists hub_access_read on public.hub_access;
create policy hub_access_read on public.hub_access
  for select to authenticated using (user_id = auth.uid() or public.hub_is_admin());

drop policy if exists hub_activity_read on public.hub_activity;
create policy hub_activity_read on public.hub_activity
  for select to authenticated using (public.hub_is_admin());

-- ------------------------------------------------------- yeni kullanıcı
create or replace function public.hub_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.hub_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists hub_on_auth_user on auth.users;
create trigger hub_on_auth_user
  after insert on auth.users
  for each row execute function public.hub_new_user();

-- ------------------------------------------- rol/durum koruma tetikleyicisi
-- Normal kullanıcı kendini admin yapamaz; sadece admin rol/durum değiştirebilir.
create or replace function public.hub_guard_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if new.role is not distinct from old.role and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  v_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    'service_role'  -- SQL editor / sunucu tarafı
  );
  if v_role = 'service_role' then
    return new;
  end if;

  if not public.hub_is_admin() then
    raise exception 'Rol ve durum alanlarını sadece yönetici değiştirebilir';
  end if;
  return new;
end $$;

drop trigger if exists hub_guard_profile_trg on public.hub_profiles;
create trigger hub_guard_profile_trg
  before update on public.hub_profiles
  for each row execute function public.hub_guard_profile();

-- --------------------------------------------------------------- seed
insert into public.hub_apps (slug, name, description, url, emoji, color, category, sort) values
  ('zapchat', 'ZapChat',
   'WhatsApp benzeri mesajlaşma: mesaj, fotoğraf, video, ses kaydı, gruplar',
   'https://zapmesaj.vercel.app', '💬', '#25d366', 'Mesajlaşma', 10),
  ('sucuk-agent', 'Sucuk Agent',
   'Yapay zekâ destekli ajan uygulaması',
   'https://sucuk-agent.vercel.app', '🤖', '#f59e0b', 'Yapay Zekâ', 20)
on conflict (slug) do nothing;

-- mevcut hesapları hub profillerine taşı
insert into public.hub_profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
from auth.users u
on conflict (id) do nothing;
