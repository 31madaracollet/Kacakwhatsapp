import { useEffect, useRef, useState } from 'react'
import { EMOJIS } from '../lib/utils'

interface Props {
  onPick: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  const list = query
    ? EMOJIS.filter((e) => e.includes(query))
    : EMOJIS

  return (
    <div className="emoji-picker" ref={ref}>
      <input
        autoFocus
        placeholder="Ara..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="emoji-search"
      />
      <div className="emoji-grid">
        {list.map((e, i) => (
          <button key={e + i} type="button" onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
        {list.length === 0 && <p className="muted small">Sonuç yok</p>}
      </div>
    </div>
  )
}
