import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { mapChat, mapMember, mapMessage, mapProfile, mapReaction } from '../lib/map'
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

function translateSendError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('row-level security')) return 'Bu sohbete mesaj gönderme yetkin yok'
  if (m.includes('yasaklandı')) return 'Hesabın yasaklandı, mesaj gönderemezsin'
  if (m.includes('foreign key')) return 'Sohbet bulunamadı'
  return msg
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
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', meId)
      if (mErr) throw mErr

      const ids = (memberships || []).map((m: any) => m.conversation_id)
      if (ids.length === 0) {
        setChats([])
        setMessages({})
        setLoading(false)
        return
      }

      const [{ data: chatRows, error: cErr }, { data: memberRows }, { data: msgRows }] = await Promise.all([
        supabase.from('conversations').select('*').in('id', ids),
        supabase.from('conversation_members').select('*, profile:profiles(*)').in('conversation_id', ids),
        supabase
          .from('messages')
          .select('*')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })
          .limit(1200),
      ])
      if (cErr) throw cErr

      const msgIds = (msgRows || []).slice(0, 400).map((m: any) => m.id)
      const { data: reactionRows } = msgIds.length
        ? await supabase.from('message_reactions').select('*').in('message_id', msgIds)
        : { data: [] as any[] }

      const memberMap = new Map<string, Member[]>()
      for (const row of (memberRows || []) as any[]) {
        const list = memberMap.get(row.conversation_id) || []
        list.push(mapMember(row))
        memberMap.set(row.conversation_id, list)
      }

      const msgMap: Record<string, Message[]> = {}
      for (const row of (msgRows || []) as any[]) {
        const msg = mapMessage(row)
        if (!msgMap[msg.chat_id]) msgMap[msg.chat_id] = []
        msgMap[msg.chat_id].push(msg)
      }
      for (const key of Object.keys(msgMap)) msgMap[key].reverse()

      const built: Chat[] = ((chatRows || []) as any[]).map((c) =>
        mapChat(c, memberMap.get(c.id) || []),
      )

      setChats(built)
      setMessages(msgMap)
      setReactions(((reactionRows || []) as any[]).map(mapReaction))
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
        const msg = mapMessage(payload.new)
        const known = chatsRef.current.some((c) => c.id === msg.chat_id)
        if (!known) {
          loadAll()
          return
        }
        setMessages((prev) => {
          if (!prev[msg.chat_id]) {
            supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', msg.chat_id)
              .order('created_at', { ascending: true })
              .limit(300)
              .then(({ data }) => {
                if (data) setMessages((cur) => ({ ...cur, [msg.chat_id]: data.map(mapMessage) }))
              })
            return prev
          }
          const list = prev[msg.chat_id]
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
        const msg = mapMessage(payload.new)
        setMessages((prev) => {
          const list = prev[msg.chat_id]
          if (!list) return prev
          return { ...prev, [msg.chat_id]: list.map((m) => (m.id === msg.id ? msg : m)) }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const old = payload.old as any
        const chatId = old.conversation_id
        if (!chatId) return
        setMessages((prev) => {
          const list = prev[chatId]
          if (!list) return prev
          return { ...prev, [chatId]: list.filter((m) => m.id !== old.id) }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
        setReactions((prev) => {
          if (payload.eventType === 'INSERT') {
            const r = mapReaction(payload.new)
            if (prev.some((x) => x.message_id === r.message_id && x.user_id === r.user_id)) return prev
            return [...prev, r]
          }
          if (payload.eventType === 'UPDATE') {
            const r = mapReaction(payload.new)
            return prev.map((x) => (x.message_id === r.message_id && x.user_id === r.user_id ? r : x))
          }
          const old = mapReaction(payload.old)
          return prev.filter((x) => !(x.message_id === old.message_id && x.user_id === old.user_id))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => {
        scheduleReload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        scheduleReload()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const p = mapProfile(payload.new)
        if (!p) return
        setChats((prev) =>
          prev.map((c) => ({
            ...c,
            members: c.members.map((m) => (m.user_id === p.id ? { ...m, profile: p } : m)),
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

  /* -------- realtime yedeği: açık sohbeti periyodik olarak tazele -------- */
  useEffect(() => {
    if (!meId || !activeChatId) return
    const tick = async () => {
      if (document.hidden) return
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeChatId)
        .order('created_at', { ascending: true })
        .limit(300)
      if (!data) return
      const fresh = data.map(mapMessage)
      setMessages((prev) => {
        const cur = prev[activeChatId] || []
        const sameLen = cur.length === fresh.length
        const sameLast = cur.length > 0 && fresh.length > 0 && cur[cur.length - 1].id === fresh[fresh.length - 1].id
        if (sameLen && sameLast) return prev
        return { ...prev, [activeChatId]: fresh }
      })
    }
    const id = window.setInterval(tick, 20000)
    return () => window.clearInterval(id)
  }, [meId, activeChatId])

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
        await supabase.rpc('mark_read', { conv: chatId })
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
            .eq('conversation_id', chatId)
            .order('created_at', { ascending: true })
            .limit(300)
            .then(({ data }) => {
              if (data) setMessages((prev) => ({ ...prev, [chatId]: data.map(mapMessage) }))
            })
        }
      }
    },
    [markRead, messages],
  )

  const sendMessage = useCallback(
    async (input: NewMessageInput) => {
      if (!meId) return
      const media_meta =
        input.media_name || input.media_size || input.media_duration || input.media_thumb
          ? {
              name: input.media_name ?? null,
              size: input.media_size ?? null,
              duration: input.media_duration ?? null,
              thumb: input.media_thumb ?? null,
            }
          : null

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.chatId,
          sender_id: meId,
          content: input.body?.trim() || null,
          type: input.type || 'text',
          media_url: input.media_url || null,
          media_meta,
          reply_to: input.reply_to || null,
        })
        .select('*')
        .single()
      if (error) throw new Error(translateSendError(error.message))

      // gönderilen mesajı anında göster (realtime gecikse bile)
      if (data) {
        const saved = mapMessage(data)
        setMessages((prev) => {
          const list = prev[saved.chat_id] || []
          if (list.some((m) => m.id === saved.id)) return prev
          return { ...prev, [saved.chat_id]: [...list, saved] }
        })
        setChats((prev) =>
          prev.map((c) => (c.id === saved.chat_id ? { ...c, last_message_at: saved.created_at } : c)),
        )
      }
      void markRead(input.chatId)
    },
    [meId, markRead],
  )

  const deleteMessage = useCallback(
    async (msg: Message) => {
      await supabase.from('message_reactions').delete().eq('message_id', msg.id)
      if (msg.sender_id === meId) {
        const { error } = await supabase
          .from('messages')
          .update({ deleted_at: new Date().toISOString(), content: null, media_url: null })
          .eq('id', msg.id)
        if (error) throw new Error(error.message)
      } else {
        // başkasının mesajı: yönetici yetkisi gerekir
        const { error } = await supabase.rpc('admin_delete_message', { mid: msg.id })
        if (error) throw new Error('Bu mesajı silme yetkin yok')
      }
    },
    [meId],
  )

  const editMessage = useCallback(async (msg: Message, body: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ content: body, edited_at: new Date().toISOString() })
      .eq('id', msg.id)
    if (error) throw new Error(error.message)
  }, [])

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!meId) return
      const existing = reactions.find((r) => r.message_id === messageId && r.user_id === meId)
      if (existing?.emoji === emoji) {
        await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', meId)
      } else if (existing) {
        await supabase.from('message_reactions').update({ emoji }).eq('message_id', messageId).eq('user_id', meId)
      } else {
        await supabase.from('message_reactions').insert({ message_id: messageId, user_id: meId, emoji })
      }
    },
    [meId, reactions],
  )

  const startDirectChat = useCallback(
    async (otherId: string) => {
      const { data, error } = await supabase.rpc('start_direct', { other: otherId })
      if (error) throw new Error(error.message)
      await loadAll()
      setActiveChatId(data as string)
      return data as string
    },
    [loadAll],
  )

  const createGroup = useCallback(
    async (name: string, memberIds: string[], avatar: string | null) => {
      const { data, error } = await supabase.rpc('create_group', {
        gname: name,
        member_ids: memberIds,
        gdesc: null,
      })
      if (error) throw new Error(error.message)
      const chatId = data as string
      // grup fotoğrafı ayrı kolonda tutulur
      if (avatar) {
        const { error: aErr } = await supabase
          .from('conversations')
          .update({ avatar_url: avatar })
          .eq('id', chatId)
        if (aErr) throw new Error(aErr.message)
      }
      await loadAll()
      setActiveChatId(chatId)
      return chatId
    },
    [loadAll],
  )

  const addMembers = useCallback(
    async (chatId: string, memberIds: string[]) => {
      const { error } = await supabase.rpc('add_members', { conv: chatId, member_ids: memberIds })
      if (error) throw new Error(error.message)
      await loadAll()
    },
    [loadAll],
  )

  const removeMember = useCallback(
    async (chatId: string, userId: string) => {
      const { error } = await supabase.rpc('remove_member', { conv: chatId, member: userId })
      if (error) throw new Error(error.message)
      await loadAll()
    },
    [loadAll],
  )

  const leaveChat = useCallback(
    async (chatId: string) => {
      const { error } = await supabase.rpc('leave_conversation', { conv: chatId })
      if (error) throw new Error(error.message)
      setActiveChatId(null)
      await loadAll()
    },
    [loadAll],
  )

  const updateChat = useCallback(
    async (chatId: string, patch: Partial<Pick<Chat, 'name' | 'avatar_url' | 'description'>>) => {
      const { error } = await supabase.from('conversations').update(patch).eq('id', chatId)
      if (error) throw new Error(error.message)
      await loadAll()
    },
    [loadAll],
  )

  const searchUsers = useCallback(async (query: string) => {
    let q = supabase.from('profiles').select('*').order('display_name').limit(40)
    const safe = query.trim().replace(/[%,()]/g, ' ').trim()
    if (safe) {
      const term = `%${safe}%`
      q = q.or(`display_name.ilike.${term},username.ilike.${term}`)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return ((data || []) as any[]).map((p) => mapProfile(p)!)
  }, [])

  /** Tüm sohbetlerde mesaj arama */
  const searchMessages = useCallback(
    async (term: string) => {
      const q = term.trim()
      if (!q || q.length < 2) return [] as { message: Message; chat: Chat | null }[]
      const ids = chatsRef.current.map((c) => c.id)
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', ids)
        .ilike('content', `%${q.replace(/[%_]/g, ' ')}%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw new Error(error.message)
      return ((data || []) as any[]).map((row) => {
        const message = mapMessage(row)
        return { message, chat: chatsRef.current.find((c) => c.id === message.chat_id) || null }
      })
    },
    [],
  )

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
    searchMessages,
    markRead,
    sendTyping,
    reload: loadAll,
  }
}

export type Messenger = ReturnType<typeof useMessenger>
