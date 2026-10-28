import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2 } from 'lucide-react'
import type { Calls } from '../hooks/useCalls'
import { Avatar } from './Avatar'
import { formatDuration } from '../lib/utils'

interface Props {
  c: Calls
}

function Stream({ stream, muted }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => {})
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className="call-video" />
}

export function CallOverlay({ c }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [blocked, setBlocked] = useState(false)
  const { call, state, incoming } = c

  /* sesli aramada sesin çalması: uzak ses akışını <audio>ya bağla */
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (el.srcObject !== c.remoteStream) el.srcObject = c.remoteStream
    el.muted = false
    el.volume = 1
    if (c.remoteStream) {
      el.play()
        .then(() => setBlocked(false))
        .catch(() => {
          /* tarayıcı otomatik oynatmayı engelledi → kullanıcı dokunuşu beklenir */
          setBlocked(true)
        })
    }
  }, [c.remoteStream])

  const resumeAudio = () => {
    const el = audioRef.current
    if (!el || !c.remoteStream) return
    el.play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true))
  }

  if (!call && !incoming) return null

  /* --------------------------------------------------------- gelen çağrı */
  if (incoming && !call) {
    return (
      <div className="call-overlay" onClick={resumeAudio}>
        <div className="call-card">
          <Avatar name={incoming.fromName} src={incoming.fromAvatar} size={96} seed={incoming.from} />
          <h2>{incoming.fromName}</h2>
          <p className="muted">{incoming.kind === 'video' ? 'Görüntülü arama…' : 'Sesli arama…'}</p>
          <div className="call-actions">
            <button className="call-btn reject" onClick={() => void c.reject()} title="Reddet">
              <PhoneOff size={26} />
            </button>
            <button className="call-btn accept" onClick={() => void c.accept()} title="Kabul et">
              {incoming.kind === 'video' ? <Video size={26} /> : <Phone size={26} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!call) return null

  const durum =
    state === 'outgoing'
      ? 'Aranıyor…'
      : state === 'connecting'
        ? 'Bağlanıyor…'
        : formatDuration(c.seconds)

  const videoMode = call.kind === 'video'

  return (
    <div className={`call-overlay ${videoMode ? 'video-mode' : ''}`} onClick={resumeAudio}>
      {/* sesli aramada ses buradan gelir */}
      <audio ref={audioRef} autoPlay playsInline className="call-audio" />

      <div className="call-card">
        {videoMode && state === 'active' ? (
          <div className="call-stage">
            <Stream stream={c.remoteStream} />
            <div className="call-pip">
              <Stream stream={c.localStream} muted />
            </div>
          </div>
        ) : (
          <>
            <Avatar name={call.peerName} src={call.peerAvatar} size={110} seed={call.peerId} />
            <h2>{call.peerName}</h2>
            <p className="call-status">
              {videoMode ? <Video size={14} /> : <Volume2 size={14} />} {durum}
            </p>
          </>
        )}

        {c.error && <p className="call-error">{c.error}</p>}

        {blocked && !videoMode && (
          <button className="call-unlock" onClick={resumeAudio}>
            <Volume2 size={16} /> Sesi aç (tarayıcı sesi engelledi)
          </button>
        )}

        <div className="call-actions" onClick={(e) => e.stopPropagation()}>
          <button className={`call-btn ghost ${c.muted ? 'off' : ''}`} onClick={c.toggleMute} title="Sesi kapat">
            {c.muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          {videoMode && (
            <button className={`call-btn ghost ${c.cameraOff ? 'off' : ''}`} onClick={c.toggleCamera} title="Kamerayı kapat">
              {c.cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
          <button className="call-btn reject" onClick={() => void c.end()} title="Kapat">
            <PhoneOff size={26} />
          </button>
        </div>

        {videoMode && state === 'active' && <span className="call-mini-label">{durum}</span>}
        {!videoMode && state === 'active' && (
          <span className="call-mini-label">Sesli arama · mikrofon açık</span>
        )}
      </div>
    </div>
  )
}
