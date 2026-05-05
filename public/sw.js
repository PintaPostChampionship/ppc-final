// PPC Tennis — Service Worker
// Handles: basic caching, push notifications, notification clicks

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Basic fetch handler (pass-through, can add caching later)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
});

// ── Push notification handler ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload;
  
  try {
    const raw = event.data ? event.data.text() : '';
    const parsed = JSON.parse(raw);
    
    if (parsed && typeof parsed.title === 'string' && typeof parsed.body === 'string') {
      payload = parsed;
    } else {
      payload = { title: 'PPC Tennis', body: raw, data: { url: '/' } };
    }
  } catch (e) {
    // If JSON parsing fails, show generic notification with raw text
    const text = event.data ? event.data.text() : 'Nueva notificación';
    payload = { title: 'PPC Tennis', body: text, data: { url: '/' } };
  }

  const options = {
    body: payload.body,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-dark.png',
    data: payload.data || { url: '/' },
    actions: payload.data?.actions || payload.actions || [],
    vibrate: [200, 100, 200],
    tag: payload.tag || 'ppc-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ── Notification click handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Check if an action button was clicked
  let targetUrl = '/';
  
  if (event.action && event.notification.data?.actions) {
    const action = event.notification.data.actions.find(a => a.action === event.action);
    if (action && action.url) {
      targetUrl = action.url;
    }
  } else if (event.notification.data?.url) {
    targetUrl = event.notification.data.url;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
