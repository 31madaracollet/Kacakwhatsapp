import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import type { Message } from '../lib/types'
import { EmojiPicker } from './EmojiPicker'
import { formatDuration } from '../lib/utils'

type AttachKind = 'image' | 'video' | 'file'

interface Props {
  onSendText: (text: string) => Promise<void> | void
  onSendFiles: (files: File[], kind: AttachKind) => Promise<void> | void
  onSendVoice: (blob: Blob, duration: number) => Promise<void> | void
  onTyping: () => void
  replyTo: Message | null
  editing: Message | null
  onCancelReply: () => void
  onCancelEdit: () => void
  onSaveEdit: (text: string) => void
  disabled?: boolean
}

export function MessageInput({
  onSendText,
  onSendFiles,
  onSendVoice,
  onTyping,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSaveEdit,
  disabled,
}: Props) {
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const secondsRef = useRef(0)
  const [busy, setBusy] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    if (editing) {
      setText(editing.body || '')
      textareaRef.current?.focus()
    }
  }, [editing])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [text])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorder.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const submit = async () => {
    if (busy) return // çift dokunuşta iki mesaj gitmesin
    const value = text.trim()
    if (!value) return
    if (editing) {
      onSaveEdit(value)
      setText('')
      return
    }
    setBusy(true)
    try {
      await onSendText(value)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  const handleFiles = async (files: FileList | null, kind: AttachKind) => {
    if (!files || files.length === 0 || busy) return
    setAttachOpen(false)
    setBusy(true)
    try {
      await onSendFiles(Array.from(files), kind)
    } finally {
      setBusy(false)
      if (imageInput.current) imageInput.current.value = ''
      if (videoInput.current) videoInput.current.value = ''
      if (fileInput.current) fileInput.current.value = ''
      if (cameraInput.current) cameraInput.current.value = ''
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      cancelled.current = false
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        const dur = secondsRef.current
        setRecording(false)
        setSeconds(0)
        secondsRef.current = 0
        if (cancelled.current) return
        const blob = new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size < 600) return
        setBusy(true)
        try {
          await onSendVoice(blob, dur)
        } finally {
          setBusy(false)
        }
      }
      recorder.start(250)
      mediaRecorder.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
      }, 1000)
    } catch {
      alert('Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.')
    }
  }

  const stopRecording = (send: boolean) => {
    cancelled.current = !send
    mediaRecorder.current?.stop()
  }

  return (
    <div className="composer">
      {(replyTo || editing) && (
        <div className="composer-context">
          <div className="context-bar" />
          <div className="context-text">
            <strong>{editing ? 'Mesajı düzenle' : 'Yanıtlanıyor'}</strong>
            <p className="ellipsis">
              {editing
                ? editing.body
                : replyTo?.type === 'text'
                  ? replyTo?.body
                  : replyTo?.type === 'image'
                    ? '📷 Fotoğraf'
                    : replyTo?.type === 'video'
                      ? '🎬 Video'
                      : replyTo?.type === 'audio'
                        ? '🎤 Sesli mesaj'
                        : `📎 ${replyTo?.media_name || 'Dosya'}`}
            </p>
          </div>
          <button
            className="icon-btn"
            onClick={() => {
              onCancelReply()
              onCancelEdit()
              if (editing) setText('')
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {recording ? (
        <div className="recording-bar">
          <button className="rec-trash" onClick={() => stopRecording(false)} title="İptal">
            <Trash2 size={19} />
          </button>
          <span className="rec-dot" />
          <span className="rec-time">{formatDuration(seconds)}</span>
          <span className="rec-hint">Kaydediliyor... göndermek için dokun</span>
          <button className="rec-send" onClick={() => stopRecording(true)} title="Gönder">
            <Send size={18} />
          </button>
        </div>
      ) : (
        <>
          <button className="icon-btn composer-icon" onClick={() => setEmojiOpen((v) => !v)} title="Emoji">
            <Smile size={22} />
          </button>

          <div className="attach-wrap">
            <button className="icon-btn composer-icon" onClick={() => setAttachOpen((v) => !v)} title="Ekle">
              <Paperclip size={22} />
            </button>
            {attachOpen && (
              <div className="attach-menu">
                <button onClick={() => imageInput.current?.click()}>
                  <ImageIcon size={18} /> Fotoğraf
                </button>
                <button onClick={() => videoInput.current?.click()}>
                  <Video size={18} /> Video
                </button>
                <button onClick={() => cameraInput.current?.click()}>
                  <Camera size={18} /> Kamera
                </button>
                <button onClick={() => fileInput.current?.click()}>
                  <FileText size={18} /> Dosya
                </button>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={disabled ? 'Sohbet seç' : editing ? 'Mesajı düzenle...' : 'Bir mesaj yaz...'}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              setText(e.target.value)
              onTyping()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
              if (e.key === 'Escape') {
                onCancelReply()
                onCancelEdit()
              }
            }}
          />

          {text.trim() ? (
            <button className="send-btn" onClick={submit} disabled={busy} title="Gönder">
              <Send size={20} />
            </button>
          ) : (
            <button className="send-btn mic" onClick={startRecording} disabled={busy || disabled} title="Ses kaydı">
              <Mic size={20} />
            </button>
          )}
        </>
      )}

      {emojiOpen && (
        <EmojiPicker
          onPick={(emoji) => {
            setText((t) => t + emoji)
            textareaRef.current?.focus()
          }}
          onClose={() => setEmojiOpen(false)}
        />
      )}

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files, 'image')}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files, 'video')}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={(e) => handleFiles(e.target.files, 'image')}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files, 'file')}
      />

      {busy && (
        <div className="uploading-pill">
          <Square size={12} /> Yükleniyor...
        </div>
      )}
    </div>
  )
}
