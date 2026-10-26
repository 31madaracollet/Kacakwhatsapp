import { colorFor, initials } from '../lib/utils'

interface Props {
  name?: string | null
  src?: string | null
  size?: number
  online?: boolean
  seed?: string | null
  className?: string
}

export function Avatar({ name, src, size = 44, online, seed, className = '' }: Props) {
  return (
    <div
      className={`avatar ${className}`}
      style={{ width: size, height: size, background: src ? 'transparent' : colorFor(seed || name) }}
    >
      {src ? (
        <img src={src} alt={name || 'avatar'} loading="lazy" />
      ) : (
        <span style={{ fontSize: size * 0.38 }}>{initials(name)}</span>
      )}
      {online && <i className="online-dot" />}
    </div>
  )
}
