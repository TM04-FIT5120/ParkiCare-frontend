// Firebase Messaging Service Worker
// Handles background push notifications (tab closed / app not in focus)
// and PWA lifecycle events required for Chrome "Add to Home Screen" installability.

// ── API base URL ─────────────────────────────────────────────────────────────
// Detect dev vs prod so action-button API calls reach the right server.
const API_BASE = self.location.hostname === 'localhost'
  ? 'http://localhost:8080/api'
  : 'https://futurestack.webhop.me/api';

// ── PWA lifecycle ────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Chrome requires a fetch handler before it will show the "Add to Home Screen"
// prompt. This handler uses a network-first strategy so the app always gets
// fresh content but falls back to cache when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a clone of successful responses for offline fallback.
        // Clone BEFORE returning so both the cache and the browser get their own copy.
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open('parkicare-v1').then((c) => c.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
// ── End PWA lifecycle ────────────────────────────────────────────────────────

// ── Notification click handler ───────────────────────────────────────────────
// Handles action buttons ("Mark as Done", "Snooze 5 min") and the default body
// click (focus/open the app tab).
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const { remindId, caregiverId } = notification.data || {};

  notification.close();

  if (action === 'mark-done') {
    // Confirm the reminder via API and bring the app into focus.
    event.waitUntil(
      Promise.all([
        remindId && caregiverId
          ? fetch(`${API_BASE}/reminder/confirm/${remindId}?caregiverId=${caregiverId}`, { method: 'PATCH' })
              .catch(() => { /* non-critical - user can still confirm in-app */ })
          : Promise.resolve(),
        focusOrOpenApp(),
      ])
    );
  } else if (action === 'snooze') {
    // Call the snooze API. The scheduler will re-fire the notification in 5 minutes.
    event.waitUntil(
      remindId && caregiverId
        ? fetch(`${API_BASE}/reminder/later/${remindId}?caregiverId=${caregiverId}`, { method: 'PATCH' })
            .catch(() => { /* non-critical */ })
        : Promise.resolve()
    );
  } else {
    // Default body click - open or focus the app.
    event.waitUntil(focusOrOpenApp());
  }
});

/** Focus an existing app window or open a new one at the root. */
function focusOrOpenApp() {
  return clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    });
}

/**
 * When FCM strips the data fields we still know a push arrived.
 * Broadcast a lightweight signal so any open tab can fetch the
 * pending reminder from the API and show the in-app modal.
 */
function broadcastNotificationReceived(title, body) {
  const payload = {
    type: 'NOTIFICATION_RECEIVED',
    title: title ?? 'Medication Reminder',
    body: body ?? 'You have a new notification.',
  };
  console.log('[SW broadcastNotificationReceived] Broadcasting:', JSON.stringify(payload));
  try {
    const channel = new BroadcastChannel('parkicare-alerts');
    channel.postMessage(payload);
    channel.close();
  } catch (e) {
    console.warn('[SW broadcastNotificationReceived] BroadcastChannel unavailable:', e);
  }
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    console.log('[SW broadcastNotificationReceived] Matched clients:', clientList.length);
    for (const client of clientList) {
      client.postMessage(payload);
    }
  });
}

function broadcastMedicationAlert({ remindId, caregiverId, title, body }) {
  const payload = {
    type: 'MEDICATION_ALERT',
    remindId,
    caregiverId,
    title: title ?? 'ParkiCare',
    body: body ?? 'Medication reminder.',
  };

  console.log('[SW broadcastMedicationAlert] Broadcasting payload:', JSON.stringify(payload));

  // BroadcastChannel path
  try {
    const channel = new BroadcastChannel('parkicare-alerts');
    channel.postMessage(payload);
    channel.close();
    console.log('[SW broadcastMedicationAlert] BroadcastChannel message sent.');
  } catch (e) {
    console.warn('[SW broadcastMedicationAlert] BroadcastChannel unavailable:', e);
  }

  // ServiceWorker -> controlled client message path
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    console.log('[SW broadcastMedicationAlert] Matched clients:', clientList.length);
    for (const client of clientList) {
      client.postMessage(payload);
      console.log('[SW broadcastMedicationAlert] postMessage sent to client:', client.url);
    }
  });
}
// ── End notification click handler ───────────────────────────────────────────

// ── Raw push interceptor (runs before Firebase) ──────────────────────────────
// Firebase compat v10 (SW) → Firebase modular v12 (React app): version mismatch
// causes MessagePayload.data to arrive as undefined in onMessage, so the normal
// dispatchAlert path is silently skipped. This raw push listener reads the FCM
// payload directly from event.data.json() - no SDK parsing, no version issues -
// and broadcasts via BroadcastChannel so the React app always gets the alert
// regardless of whether the tab is foreground or background.
self.addEventListener('push', (event) => {
  console.log('[SW push] Event fired. Has data:', !!event.data);
  if (!event.data) {
    console.warn('[SW push] No data in push event - skipping.');
    return;
  }
  try {
    const raw = event.data.json();
    console.log('[SW push] Raw JSON parsed:', JSON.stringify(raw));
    // FCM data-only messages nest custom fields under raw.data
    const data = raw.data ?? {};
    const { remindId, caregiverId, title, body } = data;
    console.log('[SW push] Extracted fields:', { remindId, caregiverId, title, body });
    if (remindId && caregiverId) {
      console.log('[SW push] Valid alert - broadcasting full alert.');
      event.waitUntil(
        broadcastMedicationAlert({ remindId, caregiverId, title, body })
      );
    } else {
      // FCM stripped the data fields. Broadcast a lightweight signal so the
      // React app can call the API to recover remindId/caregiverId.
      const notifTitle = raw.notification?.title ?? title;
      const notifBody = raw.notification?.body ?? body;
      console.warn('[SW push] Missing remindId/caregiverId - broadcasting NOTIFICATION_RECEIVED fallback.', { notifTitle, notifBody });
      event.waitUntil(
        broadcastNotificationReceived(notifTitle, notifBody)
      );
    }
  } catch (e) {
    console.error('[SW push] Failed to parse raw push payload:', e);
  }
});

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

// Background notifications (tab in background or app closed).
// Backend sends data-only FCM messages so title/body/remindId/caregiverId all
// come from payload.data, this guarantees the service worker handles the
// message on every platform, including Android Chrome PWA.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW onBackgroundMessage] Fired. Full payload:', JSON.stringify(payload));
  const title = payload.data?.title ?? 'ParkiCare';
  const body = payload.data?.body ?? 'You have a new notification.';
  const remindId = payload.data?.remindId;
  const caregiverId = payload.data?.caregiverId;
  console.log('[SW onBackgroundMessage] Extracted:', { remindId, caregiverId, title, body });

  self.registration.showNotification(title, {
    body: `Time to administer: ${body}`,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    // tag deduplicates: if the backend sends the same remindId twice, the OS
    // replaces the existing notification rather than showing a duplicate.
    tag: remindId,
    actions: [
      { action: 'mark-done', title: 'Mark as Done' },
      { action: 'snooze',    title: 'Snooze 5 min' },
    ],
    data: { remindId, caregiverId },
  });

  // Tell any open app tabs to show the in-app blocking modal.
  // BroadcastChannel is used instead of clients.matchAll() + client.postMessage()
  // because clients.matchAll() returns an empty list on Windows Chrome when the
  // tab is visible but the OS window doesn't have focus, a well-known Chrome bug.
  // BroadcastChannel broadcasts to all listening pages without needing to enumerate
  // clients, making it reliable across all desktop and mobile platforms.
  if (remindId && caregiverId) {
    broadcastMedicationAlert({ remindId, caregiverId, title, body });
  } else {
    console.warn('[SW onBackgroundMessage] Missing remindId/caregiverId - broadcasting NOTIFICATION_RECEIVED fallback.');
    broadcastNotificationReceived(title, body);
  }
});
