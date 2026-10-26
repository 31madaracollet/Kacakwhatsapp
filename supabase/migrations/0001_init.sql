-- =====================================================================
-- ZapMesaj - WhatsApp benzeri mesajlaşma uygulaması veritabanı şeması
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- types
do $$ begin
  create type public.chat_type as enum ('direct', 'group');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null default '',
  avatar_url  text,
  about       text default 'ZapMesaj kullanıyorum 🚀',
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- yeni kullanıcı -> otomatik profil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_full     text;
begin
  v_full := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_username := coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));
  v_username := regexp_replace(lower(v_username), '[^a-z0-9_]', '', 'g');
  if v_username = '' or v_username is null then
    v_username := 'kullanici';
  end if;
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := v_username || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;

  insert into public.profiles (id, username, full_name)
  values (new.id, v_username, v_full)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ chats
create table if not exists public.chats (
  id          uuid primary key default gen_random_uuid(),
  type        public.chat_type not null default 'direct',
  name        text,
  avatar_url  text,
  description text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id      uuid not null references public.chats(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  last_read_at timestamptz not null default now(),
  is_muted     boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index if not exists chat_members_user_idx on public.chat_members(user_id);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;

-- RLS yardımcıları (security definer -> sonsuz döngü yok)
create or replace function public.is_chat_member(p_chat uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat and user_id = auth.uid()
  );
$$;

create or replace function public.is_chat_admin(p_chat uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat and user_id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "chats_select_member" on public.chats;
create policy "chats_select_member" on public.chats
  for select to authenticated using (public.is_chat_member(id));

drop policy if exists "chats_update_admin" on public.chats;
create policy "chats_update_admin" on public.chats
  for update to authenticated using (public.is_chat_admin(id)) with check (public.is_chat_admin(id));

drop policy if exists "chats_delete_creator" on public.chats;
create policy "chats_delete_creator" on public.chats
  for delete to authenticated using (created_by = auth.uid());

drop policy if exists "members_select" on public.chat_members;
create policy "members_select" on public.chat_members
  for select to authenticated using (public.is_chat_member(chat_id));

drop policy if exists "members_update_own" on public.chat_members;
create policy "members_update_own" on public.chat_members
  for update to authenticated using (user_id = auth.uid() or public.is_chat_admin(chat_id))
  with check (user_id = auth.uid() or public.is_chat_admin(chat_id));

-- ---------------------------------------------------------------- messages
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  chat_id       uuid not null references public.chats(id) on delete cascade,
  sender_id     uuid not null references auth.users(id) on delete cascade,
  body          text,
  type          text not null default 'text'
                check (type in ('text', 'image', 'video', 'audio', 'file', 'system')),
  media_url     text,
  media_name    text,
  media_size    bigint,
  media_duration numeric,
  media_thumb   text,
  reply_to      uuid references public.messages(id) on delete set null,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
);

create index if not exists messages_chat_created_idx
  on public.messages(chat_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select to authenticated using (public.is_chat_member(chat_id));

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (public.is_chat_member(chat_id) and sender_id = auth.uid());

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

-- --------------------------------------------------------------- reactions
create table if not exists public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.reactions enable row level security;

create or replace function public.can_see_message(p_message uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message and public.is_chat_member(m.chat_id)
  );
$$;

drop policy if exists "reactions_select" on public.reactions;
create policy "reactions_select" on public.reactions
  for select to authenticated using (public.can_see_message(message_id));

drop policy if exists "reactions_write" on public.reactions;
create policy "reactions_write" on public.reactions
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_message(message_id));

drop policy if exists "reactions_delete" on public.reactions;
create policy "reactions_delete" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------- RPCs
-- Birebir sohbet: varsa döndür, yoksa oluştur
create or replace function public.start_direct_chat(p_other uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_chat uuid;
begin
  if v_me is null then raise exception 'Giriş yapılmamış'; end if;
  if v_me = p_other then raise exception 'Kendinle sohbet edemezsin'; end if;

  select c.id into v_chat
  from public.chats c
  where c.type = 'direct'
    and (select count(*) from public.chat_members cm where cm.chat_id = c.id) = 2
    and exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = v_me)
    and exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = p_other)
  limit 1;

  if v_chat is not null then return v_chat; end if;

  insert into public.chats (type, created_by) values ('direct', v_me) returning id into v_chat;
  insert into public.chat_members (chat_id, user_id, role) values
    (v_chat, v_me, 'member'),
    (v_chat, p_other, 'member');
  return v_chat;
end;
$$;

-- Grup oluştur
create or replace function public.create_group(
  p_name text,
  p_member_ids uuid[],
  p_avatar text default null,
  p_description text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_chat  uuid;
  v_member uuid;
begin
  if v_me is null then raise exception 'Giriş yapılmamış'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Grup adı gerekli'; end if;

  insert into public.chats (type, name, avatar_url, description, created_by)
  values ('group', trim(p_name), p_avatar, p_description, v_me)
  returning id into v_chat;

  insert into public.chat_members (chat_id, user_id, role) values (v_chat, v_me, 'admin');

  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if v_member <> v_me then
      insert into public.chat_members (chat_id, user_id, role)
      values (v_chat, v_member, 'member')
      on conflict do nothing;
    end if;
  end loop;

  insert into public.messages (chat_id, sender_id, type, body)
  values (v_chat, v_me, 'system', 'Grup oluşturuldu');

  return v_chat;
end;
$$;

-- Gruba üye ekle
create or replace function public.add_group_members(p_chat uuid, p_member_ids uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
declare v_member uuid; v_me uuid := auth.uid();
begin
  if not public.is_chat_member(p_chat) then raise exception 'Yetkisiz'; end if;
  foreach v_member in array coalesce(p_member_ids, '{}') loop
    insert into public.chat_members (chat_id, user_id, role)
    values (p_chat, v_member, 'member') on conflict do nothing;
    insert into public.messages (chat_id, sender_id, type, body)
    select p_chat, v_me, 'system',
           coalesce((select full_name from public.profiles where id = v_member), 'Bir kullanıcı') || ' gruba katıldı';
  end loop;
end;
$$;

-- Gruptan çık / at
create or replace function public.leave_chat(p_chat uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_me uuid := auth.uid(); v_type public.chat_type;
begin
  select type into v_type from public.chats where id = p_chat;

  if v_type = 'group' then
    insert into public.messages (chat_id, sender_id, type, body)
    select p_chat, v_me, 'system',
           coalesce((select full_name from public.profiles where id = v_me), 'Bir kullanıcı') || ' gruptan ayrıldı';
  end if;

  delete from public.chat_members where chat_id = p_chat and user_id = v_me;

  -- grupta kimse kalmadıysa grubu sil
  if not exists (select 1 from public.chat_members where chat_id = p_chat) then
    delete from public.chats where id = p_chat;
  end if;
end;
$$;

-- Admin: üye çıkar
create or replace function public.remove_member(p_chat uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_chat_admin(p_chat) then raise exception 'Sadece yönetici yapabilir'; end if;
  delete from public.chat_members where chat_id = p_chat and user_id = p_user;
  insert into public.messages (chat_id, sender_id, type, body)
  select p_chat, auth.uid(), 'system',
         coalesce((select full_name from public.profiles where id = p_user), 'Bir kullanıcı') || ' gruptan çıkarıldı';
end;
$$;

-- Okundu bilgisi
create or replace function public.mark_chat_read(p_chat uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.chat_members
     set last_read_at = now()
   where chat_id = p_chat and user_id = auth.uid();
$$;

-- Son görülme
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

-- ---------------------------------------------------------------- realtime
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.chat_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null; end $$;

alter table public.messages replica identity full;
alter table public.chat_members replica identity full;
alter table public.chats replica identity full;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, null)
on conflict (id) do update set public = true, file_size_limit = 52428800;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, null)
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select using (bucket_id in ('media', 'avatars'));

drop policy if exists "media_auth_insert" on storage.objects;
create policy "media_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id in ('media', 'avatars'));

drop policy if exists "media_owner_update" on storage.objects;
create policy "media_owner_update" on storage.objects
  for update to authenticated using (owner = auth.uid());

drop policy if exists "media_owner_delete" on storage.objects;
create policy "media_owner_delete" on storage.objects
  for delete to authenticated using (owner = auth.uid());
