-- =====================================================================
-- ZapMesaj 0003 — Durum · Yönetici · Arama (sesli/görüntülü)
-- Canlı şema: conversations / conversation_members / messages(media_meta)
-- =====================================================================

-- ------------------------------------------------------------- yöneticilik
alter table public.profiles add column if not exists is_admin  boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;

-- hub yöneticisi ise burada da yönetici sayılır
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
      or exists (select 1 from public.hub_profiles h
                  where h.id = auth.uid() and h.role = 'admin' and h.is_active);
$$;

-- mevcut hub yöneticilerini işaretle
update public.profiles p set is_admin = true
 where exists (select 1 from public.hub_profiles h where h.id = p.id and h.role = 'admin')
   and p.is_admin = false;

-- --------------------------------------------------------------- DURUM (24s)
create table if not exists public.statuses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'text' check (kind in ('text','image','video')),
  body       text,
  media_url  text,
  media_meta jsonb,
  bg         text default '#0a7c5a',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists statuses_user_idx on public.statuses (user_id, created_at desc);

create table if not exists public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);

alter table public.statuses      enable row level security;
alter table public.status_views  enable row level security;

drop policy if exists "durum oku"    on public.statuses;
create policy "durum oku" on public.statuses for select to authenticated
  using (expires_at > now());

drop policy if exists "durum ekle"   on public.statuses;
create policy "durum ekle" on public.statuses for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "durum sil"    on public.statuses;
create policy "durum sil" on public.statuses for delete to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists "durum goruntuleme oku" on public.status_views;
create policy "durum goruntuleme oku" on public.status_views for select to authenticated
  using (viewer_id = auth.uid()
         or exists (select 1 from public.statuses s where s.id = status_id and s.user_id = auth.uid())
         or public.is_app_admin());

drop policy if exists "durum goruntuleme ekle" on public.status_views;
create policy "durum goruntuleme ekle" on public.status_views for insert to authenticated
  with check (viewer_id = auth.uid());

-- ------------------------------------------------------------- ARAMA KAYDI
create table if not exists public.call_logs (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  caller_id       uuid not null references public.profiles(id) on delete cascade,
  callee_id       uuid not null references public.profiles(id) on delete cascade,
  kind            text not null default 'audio' check (kind in ('audio','video')),
  status          text not null default 'ringing'
                  check (status in ('ringing','accepted','rejected','missed','ended')),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration        int not null default 0
);

alter table public.call_logs enable row level security;

drop policy if exists "arama oku" on public.call_logs;
create policy "arama oku" on public.call_logs for select to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid() or public.is_app_admin());

drop policy if exists "arama ekle" on public.call_logs;
create policy "arama ekle" on public.call_logs for insert to authenticated
  with check (caller_id = auth.uid());

drop policy if exists "arama guncelle" on public.call_logs;
create policy "arama guncelle" on public.call_logs for update to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid() or public.is_app_admin());

-- --------------------------------------------------------- eksik yardımcılar
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

create or replace function public.leave_conversation(conv uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.conversation_members where conversation_id = conv and user_id = auth.uid();
$$;

create or replace function public.remove_member(conv uuid, member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(conv) then raise exception 'yalnızca grup yöneticisi çıkarabilir'; end if;
  delete from public.conversation_members where conversation_id = conv and user_id = member;
end $$;

-- ------------------------------------------------------- yönetici işlemleri
create or replace function public.admin_list_users()
returns table (
  id uuid, username text, display_name text, email text, avatar_url text,
  is_admin boolean, is_banned boolean, last_seen timestamptz, created_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'yetkin yok'; end if;
  return query
    select p.id, p.username, p.display_name, u.email::text, p.avatar_url,
           p.is_admin, p.is_banned, p.last_seen, p.created_at
      from public.profiles p
      left join auth.users u on u.id = p.id
     order by p.created_at;
end $$;

create or replace function public.admin_set_admin(target uuid, value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'yetkin yok'; end if;
  if target = auth.uid() and value = false then raise exception 'kendi yöneticiliğini kaldıramazsın'; end if;
  update public.profiles set is_admin = value where id = target;
end $$;

create or replace function public.admin_set_banned(target uuid, value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'yetkin yok'; end if;
  if target = auth.uid() then raise exception 'kendini yasaklayamazsın'; end if;
  update public.profiles set is_banned = value where id = target;
  update auth.users set banned_until = case when value then now() + interval '100 years' else null end
   where id = target;
  if value then delete from auth.refresh_tokens where user_id = target::text; end if;
end $$;

create or replace function public.admin_delete_message(mid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'yetkin yok'; end if;
  update public.messages
     set deleted_at = now(), content = null, media_url = null
   where id = mid;
end $$;

create or replace function public.admin_stats()
returns json language plpgsql security definer set search_path = public as $$
declare res json;
begin
  if not public.is_app_admin() then raise exception 'yetkin yok'; end if;
  select json_build_object(
    'kullanici', (select count(*) from public.profiles),
    'yonetici',  (select count(*) from public.profiles where is_admin),
    'yasakli',   (select count(*) from public.profiles where is_banned),
    'sohbet',    (select count(*) from public.conversations),
    'mesaj',     (select count(*) from public.messages where deleted_at is null),
    'durum',     (select count(*) from public.statuses where expires_at > now()),
    'arama',     (select count(*) from public.call_logs),
    'bugun_aktif', (select count(*) from public.profiles where last_seen > now() - interval '1 day')
  ) into res;
  return res;
end $$;

-- tüm kullanıcılara duyuru gönder
create or replace function public.admin_broadcast(msg text)
returns int language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  me  uuid := auth.uid();
  say int;
begin
  if not public.is_app_admin() then raise exception 'yetkin yok'; end if;

  select c.id into cid from public.conversations c
   where c.type = 'group' and c.name = 'Duyurular' limit 1;

  if cid is null then
    insert into public.conversations (type, name, description, created_by)
    values ('group', 'Duyurular', 'Yönetici duyuruları', me) returning id into cid;
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  select cid, p.id, case when p.id = me then 'admin' else 'member' end
    from public.profiles p where p.is_banned = false
  on conflict do nothing;

  insert into public.messages (conversation_id, sender_id, type, content)
  values (cid, me, 'text', msg);

  select count(*) into say from public.conversation_members where conversation_id = cid;
  return say;
end $$;

-- ---------------------------------------------------------------- realtime
do $$ begin
  alter publication supabase_realtime add table public.statuses;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.status_views;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.call_logs;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- izinler
grant select, insert, update, delete on public.statuses, public.status_views, public.call_logs to authenticated;
grant execute on function
  public.is_app_admin(), public.touch_last_seen(), public.leave_conversation(uuid),
  public.remove_member(uuid, uuid), public.admin_list_users(), public.admin_set_admin(uuid, boolean),
  public.admin_set_banned(uuid, boolean), public.admin_delete_message(uuid),
  public.admin_stats(), public.admin_broadcast(text)
  to authenticated;

-- --------------------------------------------- yasaklı kullanıcı yazamasın
create or replace function public.block_banned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_banned, false)) then
    raise exception 'hesabınız yasaklandı';
  end if;
  return new;
end $$;

drop trigger if exists no_banned_messages on public.messages;
create trigger no_banned_messages before insert on public.messages
  for each row execute function public.block_banned();

drop trigger if exists no_banned_statuses on public.statuses;
create trigger no_banned_statuses before insert on public.statuses
  for each row execute function public.block_banned();
