import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Chat, Member, Message, Reaction } from '../lib/types'
import { useAuth } from './useAuth'

export interface NewMessageInput {
  chatId: string
  body?: string | null
  type?: Message['type']
  media_url?: string | null
  media_name?: string | null
  media_size?: number | null
  media_duration?: number | null
  media_thumb?: string | null
  reply_to?: string | null
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    osc.start()
    osc.stop(ctx.currentTime + 0.26)
  } catch {
    /* sessizce yoksay */
  }
}

export function useMessenger() {
  const { user, profile } = useAuth()
  const meId = user?.id

  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({})
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const activeRef = useRef<string | null>(null)
  const chatsRef = useRef<Chat[]>([])
  const typingChannel = useRef<RealtimeChannel | null>(null)
  const lastTypingSent = useRef(0)
  const pendingRead = useRef<Set<string>>(new Set())

  activeRef.current = activeChatId
  chatsRef.current = chats

  /* ------------------------------------------------------------ yükleme */
  const loadAll = useCallback(async () => {
    if (!meId) return
    setLoading(true)
    try {
      const { data: memberships, error: mErr } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', meId)
      if (mErr) throw mErr

      const ids = (memberships || []).map((m: any) => m.chat_id)
      if (ids.length === 0) {
        setChats([])
        setMessages({})
        setLoading(false)
        return
      }

      const [{ data: chatRows, error: cErr }, { data: memberRows }, { data: msgRows }] = await Promise.all([
        supabase.from('chats').select('*').in('id', ids),
        supabase.from('chat_members').select('*, profile:profiles(*)').in('chat_id', ids),
        supabase
          .from('messages')
          .select('*')
          .in('chat_id', ids)
          .order('created_at', { ascending: false })
          .limit(1200),
      ])
      if (cErr) throw cErr

      const msgIds = (msgRows || []).slice(0, 400).map((m: any) => m.id)
      const { data: reactionRows } = msgIds.length
        ? await supabase.from('reactions').select('*').in('message_id', msgIds)
        : { data: [] as Reaction[] }

      const memberMap = new Map<string, Member[]>()
      for (const m of (memberRows || []) as any[]) {
        const list = memberMap.get(m.chat_id) || []
        list.push({
          chat_id: m.chat_id,
          user_id: m.user_id,
          role: m.role,
          last_read_at: m.last_read_at,
          is_muted: m.is_muted,
          joined_at: m.joined_at,
          profile: m.profile,
        })
        memberMap.set(m.chat_id, list)
      }

      const msgMap: Record<string, Message[]> = {}
      for (const m of (msgRows || []) as Message[]) {
        if (!msgMap[m.chat_id]) msgMap[m.chat_id] = []
        msgMap[m.chat_id].push(m)
      }
      for (const key of Object.keys(msgMap)) msgMap[key].reverse()

      const built: Chat[] = ((chatRows || []) as any[]).map((c) => {
        const list = msgMap[c.id] || []
        return {
          ...c,
          members: memberMap.get(c.id) || [],
          last_message_at: list.length ? list[list.length - 1].created_at : c.created_at,
        }
      })

      setChats(built)
      setMessages(msgMap)
      setReactions((reactionRows || []) as Reaction[])
    } catch (e: any) {
      setError(e.message || 'Sohbetler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [meId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  /* ------------------------------------------------------------ realtime */
  useEffect(() => {
    if (!meId) return

    let reloadTimer: number | null = null
    const scheduleReload = () => {
      if (reloadTimer) window.clearTimeout(reloadTimer)
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null
        loadAll()
      }, 450)
    }

    const channel = supabase
      .channel('zapmesaj-db')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        const known = chatsRef.current.some((c) => c.id === msg.chat_id)
        if (!known) {
          loadAll()
          return
        }
        setMessages((prev) => {
          const list = prev[msg.chat_id] || []
          if (list.some((m) => m.id === msg.id)) return prev
          return { ...prev, [msg.chat_id]: [...list, msg] }
        })
        setChats((prev) =>
          prev.map((c) => (c.id === msg.chat_id ? { ...c, last_message_at: msg.created_at } : c)),
        )
        if (msg.sender_id !== meId) {
          if (activeRef.current === msg.chat_id) {
            void markRead(msg.chat_id)
          } else {
            beep()
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        setMessages((prev) => {
          const list = prev[msg.chat_id]
          if (!list) return prev
          return { ...prev, [msg.chat_id]: list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)) }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const old = payload.old as Message
        setMessages((prev) => {
          const list = prev[old.chat_id]
          if (!list) return prev
          return { ...prev, [old.chat_id]: list.filter((m) => m.id !== old.id) }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload) => {
        setReactions((prev) => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as Reaction
            if (prev.some((x) => x.message_id === r.message_id && x.user_id === r.user_id)) return prev
            return [...prev, r]
          }
          if (payload.eventType === 'UPDATE') {
            const r = payload.new as Reaction
            return prev.map((x) => (x.message_id === r.message_id && x.user_id === r.user_id ? r : x))
          }
          const old = payload.old as Reaction
          return prev.filter((x) => !(x.message_id === old.message_id && x.user_id === old.user_id))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, () => {
        scheduleReload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        scheduleReload()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const p = payload.new as any
        setChats((prev) =>
          prev.map((c) => ({
            ...c,
            members: c.members.map((m) => (m.user_id === p.id ? { ...m, profile: { ...(m.profile as any), ...p } } : m)),
          })),
        )
      })
      .subscribe()

    /* presence */
    const presence = supabase.channel('zapmesaj-presence', { config: { presence: { key: meId } } })
    presence
      .on('presence', { event: 'sync' }, () => {
        setOnlineUsers(new Set(Object.keys(presence.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ user_id: meId, online_at: new Date().toISOString() })
        }
      })

    const heartbeat = setInterval(() => {
      supabase.rpc('touch_last_seen').then(() => {})
    }, 45000)
    supabase.rpc('touch_last_seen').then(() => {})

    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer)
      clearInterval(heartbeat)
      supabase.rpc('touch_last_seen').then(() => {})
      supabase.removeChannel(channel)
      supabase.removeChannel(presence)
    }
  }, [meId, loadAll])

  /* --------------------------------------------------------- yazıyor... */
  useEffect(() => {
    if (!meId || !activeChatId) return
    const ch = supabase.channel(`typing-${activeChatId}`, { config: { broadcast: { self: false } } })
    typingChannel.current = ch
    ch.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
      if (!payload?.user_id || payload.user_id === meId) return
      setTypingUsers((prev) => {
        const list = new Set(prev[activeChatId] || [])
        list.add(payload.name || 'Birisi')
        return { ...prev, [activeChatId]: Array.from(list) }
      })
      setTimeout(() => {
        setTypingUsers((prev) => {
          const list = new Set(prev[activeChatId] || [])
          list.delete(payload.name || 'Birisi')
          return { ...prev, [activeChatId]: Array.from(list) }
        })
      }, 4000)
    }).subscribe()

    return () => {
      supabase.removeChannel(ch)
      typingChannel.current = null
    }
  }, [activeChatId, meId])

  const sendTyping = useCallback(
    (name: string) => {
      const now = Date.now()
      if (now - lastTypingSent.current < 1800) return
      lastTypingSent.current = now
      typingChannel.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: meId, name },
      })
    },
    [meId],
  )

  /* ------------------------------------------------------------- eylemler */
  const markRead = useCallback(
    async (chatId: string) => {
      if (!meId) return
      if (pendingRead.current.has(chatId)) return
      pendingRead.current.add(chatId)
      const now = new Date().toISOString()
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, members: c.members.map((m) => (m.user_id === meId ? { ...m, last_read_at: now } : m)) }
            : c,
        ),
      )
      try {
        await supabase.rpc('mark_chat_read', { p_chat: chatId })
      } finally {
        setTimeout(() => pendingRead.current.delete(chatId), 1200)
      }
    },
    [meId],
  )

  const selectChat = useCallback(
    (chatId: string | null) => {
      setActiveChatId(chatId)
      if (chatId) {
        void markRead(chatId)
        if (!messages[chatId]) {
          supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })
            .limit(300)
            .then(({ data }) => {
              if (data) setMessages((prev) => ({ ...prev, [chatId]: data as Message[] }))
            })
        }
      }
    },
    [markRead, messages],
  )

  const sendMessage = useCallback(
    async (input: NewMessageInput) => {
      if (!meId) return
      const { error } = await supabase.from('messages').insert({
        chat_id: input.chatId,
        sender_id: meId,
        body: input.body?.trim() || null,
        type: input.type || 'text',
        media_url: input.media_url || null,
        media_name: input.media_name || null,
        media_size: input.media_size ?? null,
        media_duration: input.media_duration ?? null,
        media_thumb: input.media_thumb || null,
        reply_to: input.reply_to || null,
      })
      if (error) throw new Error(error.message)
      void markRead(input.chatId)
    },
    [meId, markRead],
  )

  const deleteMessage = useCallback(async (msg: Message) => {
    await supabase.from('reactions').delete().eq('message_id', msg.id)
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), body: null, media_url: null })
      .eq('id', msg.id)
    if (error) throw new Error(error.message)
  }, [])

  const editMessage = useCallback(async (msg: Message, body: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ body, edited_at: new Date().toISOString() })
      .eq('id', msg.id)
    if (error) throw new Error(error.message)
  }, [])

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!meId) return
      const existing = reactions.find((r) => r.message_id === messageId && r.user_id === meId)
      if (existing?.emoji === emoji) {
        await supabase.from('reactions').delete().eq('message_id', messageId).eq('user_id', meId)
      } else if (existing) {
        await supabase.from('reactions').update({ emoji }).eq('message_id', messageId).eq('user_id', meId)
      } else {
        await supabase.from('reactions').insert({ message_id: messageId, user_id: meId, emoji })
      }
    },
    [meId, reactions],
  )

  const startDirectChat = useCallback(async (otherId: string) => {
    const { data, error } = await supabase.rpc('start_direct_chat', { p_other: otherId })
    if (error) throw new Error(error.message)
    await loadAll()
    setActiveChatId(data as string)
    return data as string
  }, [loadAll])

  const createGroup = useCallback(
    async (name: string, memberIds: string[], avatar: string | null) => {
      const { data, error } = await supabase.rpc('create_group', {
        p_name: name,
        p_member_ids: memberIds,
        p_avatar: avatar,
      })
      if (error) throw new Error(error.message)
      await loadAll()
      setActiveChatId(data as string)
      return data as string
    },
    [loadAll],
  )

  const addMembers = useCallback(
    async (chatId: string, memberIds: string[]) => {
      const { error } = await supabase.rpc('add_group_members', { p_chat: chatId, p_member_ids: memberIds })
      if (error) throw new Error(error.message)
      await loadAll()
    },
    [loadAll],
  )

  const removeMember = useCallback(
    async (chatId: string, userId: string) => {
      const { error } = await supabase.rpc('remove_member', { p_chat: chatId, p_user: userId })
      if (error) throw new Error(error.message)
      await loadAll()
    },
    [loadAll],
  )

  const leaveChat = useCallback(
    async (chatId: string) => {
      const { error } = await supabase.rpc('leave_chat', { p_chat: chatId })
      if (error) throw new Error(error.message)
      setActiveChatId(null)
      await loadAll()
    },
    [loadAll],
  )

  const updateChat = useCallback(
    async (chatId: string, patch: Partial<Pick<Chat, 'name' | 'avatar_url' | 'description'>>) => {
      const { error } = await supabase.from('chats').update(patch).eq('id', chatId)
      if (error) throw new Error(error.message)
      await loadAll()
    },
    [loadAll],
  )

  const searchUsers = useCallback(async (query: string) => {
    let q = supabase.from('profiles').select('*').order('full_name').limit(40)
    const safe = query.trim().replace(/[%,()]/g, ' ').trim()
    if (safe) {
      const term = `%${safe}%`
      q = q.or(`full_name.ilike.${term},username.ilike.${term}`)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data || []) as any[]
  }, [])

  const totalUnread = useMemo(() => {
    if (!meId) return 0
    let total = 0
    for (const chat of chats) {
      const me = chat.members.find((m) => m.user_id === meId)
      if (!me) continue
      const list = messages[chat.id] || []
      total += list.filter((m) => m.sender_id !== meId && new Date(m.created_at) > new Date(me.last_read_at)).length
    }
    return total
  }, [chats, messages, meId])

  return {
    meId,
    profile,
    chats,
    messages,
    reactions,
    activeChatId,
    loading,
    error,
    typingUsers,
    onlineUsers,
    totalUnread,
    selectChat,
    sendMessage,
    deleteMessage,
    editMessage,
    toggleReaction,
    startDirectChat,
    createGroup,
    addMembers,
    removeMember,
    leaveChat,
    updateChat,
    searchUsers,
    markRead,
    sendTyping,
    reload: loadAll,
  }
}

export type Messenger = ReturnType<typeof useMessenger>
