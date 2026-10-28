/** Tarayıcı bildirimleri (masaüstü + Android/iOS web bildirimleri) */

const FLAG = 'zap-bildirimler'

export type NotifState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotifState {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission as NotifState
}

/** kullanıcı bildirimleri açtı mı? (izin + tercih) */
export function notificationsEnabled() {
  try {
    return localStorage.getItem(FLAG) === '1' && notificationPermission() === 'granted'
  } catch {
    return false
  }
}

export function setNotificationsEnabled(on: boolean) {
  try {
    localStorage.setItem(FLAG, on ? '1' : '0')
  } catch {
    /* yoksay */
  }
}

/** izin iste + tercihi aç */
export async function enableNotifications(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  let perm = Notification.permission
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission()
    } catch {
      return 'denied'
    }
  }
  if (perm !== 'granted') return 'denied'
  setNotificationsEnabled(true)
  return 'ok'
}

export function disableNotifications() {
  setNotificationsEnabled(false)
}

/** küçük bir servis çalışanı: Android'de bildirim göstermek için şart */
export function registerNotificationWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* sessizce yoksay */
  })
}

/**
 * Bildirim göster. Mümkünse servis çalışanı üzerinden (mobil uyumlu),
 * olmazsa doğrudan Notification ile.
 */
export async function showNotification(
  title: string,
  body: string,
  opts?: { chatId?: string; onClick?: () => void },
) {
  if (!notificationsEnabled()) return
  const options: NotificationOptions & { data?: any } = {
    body,
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: `zap-${Date.now()}`,
    silent: false,
    data: { chatId: opts?.chatId || null, url: '/' },
  }

  // 1) servis çalışanı (Android + arka plan sekmesi)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg?.showNotification) {
        await reg.showNotification(title, options)
        return
      }
    }
  } catch {
    /* alta düş */
  }

  // 2) doğrudan
  try {
    const n = new Notification(title, options)
    n.onclick = () => {
      window.focus()
      n.close()
      opts?.onClick?.()
    }
    window.setTimeout(() => n.close(), 12000)
  } catch {
    /* yoksay */
  }
}
