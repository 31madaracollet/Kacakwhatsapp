-- 0004: grup akışındaki pürüzler
-- 1) Gruptan ayrılan son kişiyse grup silinsin (hayalet gruplar kalmasın)
-- 2) Ayrılan kişi tek yöneticiyse yöneticilik en eski üyeye geçsin

create or replace function public.leave_conversation(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me      uuid := auth.uid();
  kalan   int;
  yeniadm uuid;
  tip     text;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select type into tip from public.conversations where id = conv;
  if tip is null then return; end if;

  delete from public.conversation_members where conversation_id = conv and user_id = me;

  select count(*) into kalan from public.conversation_members where conversation_id = conv;
  if kalan = 0 then
    -- kimse kalmadı: grup da gitsin
    delete from public.conversations where id = conv;
    return;
  end if;

  -- grupta yönetici kalmadıysa en eski üyeyi yönetici yap
  if tip = 'group' and not exists (
    select 1 from public.conversation_members where conversation_id = conv and role = 'admin'
  ) then
    select user_id into yeniadm
      from public.conversation_members
     where conversation_id = conv
     order by joined_at
     limit 1;
    if yeniadm is not null then
      update public.conversation_members set role = 'admin'
       where conversation_id = conv and user_id = yeniadm;
    end if;
  end if;
end $$;

-- birebir sohbetten "ayrıl" olmasın (tek taraf silmesin), sadece gizle
create or replace function public.leave_direct(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.conversations c
     where c.id = conv and c.type = 'direct' and public.is_member(c.id)
  ) then
    raise exception 'sohbet bulunamadı';
  end if;
  update public.conversation_members set muted = true
   where conversation_id = conv and user_id = auth.uid();
end $$;

grant execute on function public.leave_conversation(uuid) to authenticated;
grant execute on function public.leave_direct(uuid) to authenticated;
