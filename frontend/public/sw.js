/**
 * Service Worker for SCELE PWA
 * Handles push notifications and basic caching
 */

// Cache name for offline support
const CACHE_NAME = 'scele-pwa-v2';
const STATIC_ASSETS = ['/', '/dashboard'];

// Install event — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Hanya cache asset yang pasti cepat/ada, hindari caching route Next.js (seperti '/' dan '/dashboard') 
      // di fase install karena bisa membuat Service Worker gagal aktif jika server merespons lambat (cold start).
      return cache.addAll([]);
    })
  );
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event — network-first strategy
self.addEventListener('fetch', (event) => {
  // Skip API calls and non-GET requests
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Push event — show notification (REQUIRED for iOS)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'SCELE Notif',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'scele-notification',
    data: data.data || { url: '/dashboard' },
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Buka',
      },
      {
        action: 'dismiss',
        title: 'Tutup',
      },
    ],
  };

  const notifType = data.data?.type || 'generic';

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'SCELE Notif', options),
      // Tell open app windows to play the signature sound
      self.clients.matchAll({ type: 'window' }).then(clients => {
        for (const client of clients) {
          client.postMessage({ type: 'PLAY_SOUND', soundType: notifType });
        }
      }),
    ])
  );
});

// Notification click — navigate to the right destination
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Dismiss action — just close
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard';

  // Check if the URL is external (e.g. scele.cs.ui.ac.id)
  const isExternal = url.startsWith('http') && !url.startsWith(self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (isExternal) {
        // External links (SCELE assignment/quiz pages): open in browser
        return self.clients.openWindow(url);
      }

      // Internal links: navigate within the PWA
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // No existing PWA window — open one
      return self.clients.openWindow(url);
    })
  );
});
