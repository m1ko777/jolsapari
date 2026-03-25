// JolSapari Service Worker
self.addEventListener('push', function(e) {
  const data = e.data ? e.data.json() : {};
  self.registration.showNotification(data.title || 'JolSapari', {
    body: data.body || 'Жаңа бронь!',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    tag: 'booking',
    requireInteraction: true
  });
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
