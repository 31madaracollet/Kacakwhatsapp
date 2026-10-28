import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { CallKind, CallLog, CallState } from '../lib/types'
import { useAuth } from './useAuth'

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

export interface ActiveCall {
  peerId: string
  peerName: string
  peerAvatar?: string | null
  kind: CallKind
  conversationId?: string | null
}

interface IncomingOffer {
  from: string
  fromName: string
  fromAvatar?: string | null
  kind: CallKind
  sdp: RTCSessionDescriptionInit
  conversationId?: string | null
  logId?: string | null
}

export function useCalls() {
  const { user } = useAuth()
  const meId = user?.id

  const [call, setCall] = useState<ActiveCall | null>(null)
  const [state, setState] = useState<CallState>('idle')
  const [incoming, setIncoming] = useState<IncomingOffer | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [logs, setLogs] = useState<CallLog[]>([])
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const pendingOffer = useRef<IncomingOffer | null>(null)
  const logIdRef = useRef<string | null>(null)
  const startRef = useRef<number>(0)
  const peerRef = useRef<string | null>(null)
  const kindRef = useRef<CallKind>('audio')
  const timerRef = useRef<number | null>(null)

  /* --------------------------------------------------- arama geçmişi */
  const loadLogs = useCallback(async () => {
    if (!meId) return
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .or(`caller_id.eq.${meId},callee_id.eq.${meId}`)
      .order('started_at', { ascending: false })
      .limit(60)
    setLogs((data || []) as CallLog[])
  }, [meId])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  /* ------------------------------------------------------------- temizlik */
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    pcRef.current?.getSenders().forEach((s) => s.track?.stop())
    pcRef.current?.close()
    pcRef.current = null
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    pendingIce.current = []
    pendingOffer.current = null
    peerRef.current = null
    setMuted(false)
    setCameraOff(false)
    setSeconds(0)
  }, [])

  /** hedef kullanıcıya broadcast gönder (kanal önbelleklenir, abone olunca yollar) */
  const outChannels = useRef<Map<string, { ch: RealtimeChannel; ready: boolean; queue: any[] }>>(new Map())
  const send = useCallback((to: string, event: string, payload: any) => {
    const key = `call-${to}`
    let entry = outChannels.current.get(key)
    if (!entry) {
      const ch = supabase.channel(key, { config: { broadcast: { self: false } } })
      entry = { ch, ready: false, queue: [] }
      outChannels.current.set(key, entry)
      ch.subscribe((status) => {
        const e = outChannels.current.get(key)
        if (!e) return
        if (status === 'SUBSCRIBED') {
          e.ready = true
          for (const msg of e.queue.splice(0)) void e.ch.send(msg)
        }
      })
    }
    const msg = { type: 'broadcast' as const, event, payload }
    if (entry.ready) void entry.ch.send(msg)
    else entry.queue.push(msg)
  }, [])

  const startTimer = useCallback(() => {
    startRef.current = Date.now()
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
  }, [])

  const createPc = useCallback(
    (peerId: string) => {
      const pc = new RTCPeerConnection(ICE)
      pcRef.current = pc

      pc.onicecandidate = (e) => {
        if (e.candidate) send(peerId, 'ice', { from: meId, candidate: e.candidate.toJSON() })
      }
      pc.ontrack = (e) => {
        const [stream] = e.streams
        if (stream) setRemoteStream(stream)
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setState('active')
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          /* kapanışta hangup akışı devralır */
        }
      }
      return pc
    },
    [meId, send],
  )

  const getMedia = useCallback(async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    })
    localRef.current = stream
    setLocalStream(stream)
    return stream
  }, [])

  const flushIce = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    for (const c of pendingIce.current.splice(0)) {
      try {
        await pc.addIceCandidate(c)
      } catch {
        /* yoksay */
      }
    }
  }, [])

  /* ------------------------------------------------------------- arama başlat */
  const startCall = useCallback(
    async (peer: { id: string; name: string; avatar_url?: string | null }, kind: CallKind, conversationId?: string | null) => {
      if (!meId || !peer?.id) return
      setError(null)
      try {
        peerRef.current = peer.id
        kindRef.current = kind
        setCall({ peerId: peer.id, peerName: peer.name, peerAvatar: peer.avatar_url, kind, conversationId })
        setState('outgoing')

        const stream = await getMedia(kind)
        const pc = createPc(peer.id)
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))

        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: kind === 'video' })
        await pc.setLocalDescription(offer)

        const { data } = await supabase
          .from('call_logs')
          .insert({
            conversation_id: conversationId ?? null,
            caller_id: meId,
            callee_id: peer.id,
            kind,
            status: 'ringing',
          })
          .select('id')
          .single()
        logIdRef.current = data?.id ?? null

        send(peer.id, 'offer', {
          from: meId,
          fromName: '',
          kind,
          sdp: offer,
          conversationId: conversationId ?? null,
          logId: logIdRef.current,
        })
      } catch (e: any) {
        setError(e.message || 'Arama başlatılamadı')
        cleanup()
        setCall(null)
        setState('idle')
      }
    },
    [cleanup, createPc, getMedia, meId, send],
  )

  /* --------------------------------------------------------------- kabul */
  const accept = useCallback(async () => {
    const offer = pendingOffer.current
    if (!offer) return
    try {
      setState('connecting')
      const stream = await getMedia(offer.kind)
      const pc = createPc(offer.from)
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      await pc.setRemoteDescription(offer.sdp)
      await flushIce()
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      send(offer.from, 'answer', { from: meId, sdp: answer })
      if (offer.logId) {
        logIdRef.current = offer.logId
        await supabase.from('call_logs').update({ status: 'accepted' }).eq('id', offer.logId)
      }
      setCall({
        peerId: offer.from,
        peerName: offer.fromName,
        peerAvatar: offer.fromAvatar,
        kind: offer.kind,
        conversationId: offer.conversationId,
      })
      setIncoming(null)
      pendingOffer.current = null
      startTimer()
      setState('active')
    } catch (e: any) {
      setError(e.message || 'Arama kabul edilemedi')
      send(offer.from, 'reject', { from: meId })
      cleanup()
      setIncoming(null)
      setState('idle')
    }
  }, [cleanup, createPc, flushIce, getMedia, meId, send, startTimer])

  /* --------------------------------------------------------------- bitir */
  const end = useCallback(
    async (reason: 'ended' | 'rejected' = 'ended') => {
      const peer = peerRef.current
      if (peer) send(peer, 'hangup', { from: meId, reason })
      const dur = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0
      if (logIdRef.current) {
        await supabase
          .from('call_logs')
          .update({ status: reason === 'rejected' ? 'rejected' : 'ended', ended_at: new Date().toISOString(), duration: dur })
          .eq('id', logIdRef.current)
      }
      logIdRef.current = null
      cleanup()
      setCall(null)
      setIncoming(null)
      setState('idle')
      void loadLogs()
    },
    [cleanup, loadLogs, meId, send],
  )

  const reject = useCallback(async () => {
    const offer = pendingOffer.current
    if (offer) {
      send(offer.from, 'reject', { from: meId })
      if (offer.logId) {
        await supabase.from('call_logs').update({ status: 'rejected', ended_at: new Date().toISOString() }).eq('id', offer.logId)
      }
    }
    pendingOffer.current = null
    setIncoming(null)
    setState('idle')
    void loadLogs()
  }, [loadLogs, meId, send])

  const toggleMute = useCallback(() => {
    const stream = localRef.current
    if (!stream) return
    const next = !muted
    stream.getAudioTracks().forEach((t) => (t.enabled = !next))
    setMuted(next)
  }, [muted])

  const toggleCamera = useCallback(() => {
    const stream = localRef.current
    if (!stream) return
    const next = !cameraOff
    stream.getVideoTracks().forEach((t) => (t.enabled = !next))
    setCameraOff(next)
  }, [cameraOff])

  /* --------------------------------------------------- gelen çağrı dinle */
  useEffect(() => {
    if (!meId) return
    const ch = supabase
      .channel(`call-${meId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        // zaten aramadaysa meşgul
        if (pcRef.current || incoming || state === 'active') {
          send(payload.from, 'reject', { from: meId })
          return
        }
        const offer: IncomingOffer = {
          from: payload.from,
          fromName: payload.fromName || 'Birisi',
          fromAvatar: payload.fromAvatar ?? null,
          kind: payload.kind || 'audio',
          sdp: payload.sdp,
          conversationId: payload.conversationId ?? null,
          logId: payload.logId ?? null,
        }
        pendingOffer.current = offer
        peerRef.current = offer.from
        kindRef.current = offer.kind
        setIncoming(offer)
        setState('incoming')
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = 520
          gain.gain.value = 0.05
          osc.start()
          setTimeout(() => {
            osc.stop()
            ctx.close()
          }, 500)
        } catch {
          /* yoksay */
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        const pc = pcRef.current
        if (!pc) return
        try {
          await pc.setRemoteDescription(payload.sdp)
          await flushIce()
          startTimer()
          setState('active')
        } catch (e: any) {
          setError(e.message || 'Bağlantı kurulamadı')
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }: any) => {
        const pc = pcRef.current
        if (!pc || !payload?.candidate) return
        if (!pc.remoteDescription) {
          pendingIce.current.push(payload.candidate)
          return
        }
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch {
          /* yoksay */
        }
      })
      .on('broadcast', { event: 'reject' }, () => {
        if (!pcRef.current && !pendingOffer.current) return
        void end('rejected')
        setError('Arama reddedildi')
      })
      .on('broadcast', { event: 'hangup' }, () => {
        // karşı taraf kapattı; zaten kapalıysa yok say (sonsuz hangup döngüsünü önler)
        if (!pcRef.current && !pendingOffer.current) return
        void end('ended')
      })
      .subscribe()

    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, flushIce, startTimer, send])

  useEffect(
    () => () => {
      cleanup()
      for (const [, entry] of outChannels.current) supabase.removeChannel(entry.ch)
      outChannels.current.clear()
    },
    [cleanup],
  )

  return {
    call,
    state,
    incoming,
    muted,
    cameraOff,
    localStream,
    remoteStream,
    seconds,
    logs,
    error,
    startCall,
    accept,
    reject,
    end,
    toggleMute,
    toggleCamera,
    loadLogs,
  }
}

export type Calls = ReturnType<typeof useCalls>
