/* ZapMesaj bildirim servis çalışanı — yalnızca bildirim gösterme + tıklama */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const chatId = (event.notification.data && event.notification.data.chatId) || null
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c)
      if (open) {
        open.postMessage({ type: 'zap-notification-click', chatId })
        return open.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
