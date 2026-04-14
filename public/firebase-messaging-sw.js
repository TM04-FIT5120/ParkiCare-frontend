// Firebase Messaging Service Worker
// Handles background push notifications (tab closed / app not in focus)
// and PWA lifecycle events required for Chrome "Add to Home Screen" installability.

// ── PWA lifecycle ────────────────────────────────────────────────────────────
// Claim clients immediately so the SW controls the page on first load without
// requiring a page reload after installation.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Chrome requires a fetch handler before it will show the "Add to Home Screen"
// prompt. This handler uses a network-first strategy so the app always gets
// fresh content but falls back to cache when offline.
self.addEventListener('fetch', (event) => {
  // Only intercept same-origin GET requests; let everything else pass through.
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a clone of successful responses for offline fallback.
        if (response && response.status === 200) {
          const cache = caches.open('parkicare-v1').then((c) => c.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
// ── End PWA lifecycle ────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBc8EabLQQzZ316UKj_NUT3pF4LQ6wTTIw",
  authDomain: "parkicare-my.firebaseapp.com",
  projectId: "parkicare-my",
  storageBucket: "parkicare-my.firebasestorage.app",
  messagingSenderId: "4346064972",
  appId: "1:4346064972:web:381469c1c0c316793084e9",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'ParkiCare';
  const body = payload.notification?.body ?? 'You have a new notification.';

  self.registration.showNotification(title, {
    body,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
  });
});
