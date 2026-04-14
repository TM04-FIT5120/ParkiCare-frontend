import { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase';
import { registerPushToken } from '@/services/pushNotifications';
import { useAuth } from '@/context/AuthContext';

const VAPID_KEY = 'BO-VIv4NIIiqsoHglpLaLT6oVsRTmqXW8bV3CvotCOs677zl8M0pytv26Wi61lKvaQmDxo4nhNdGBHkE9fGS6W4';

const STORAGE_KEY_PREFIX = 'fcm_token_';

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.caregiverId) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'denied') return;

    const caregiverId = user.caregiverId;
    const storageKey = `${STORAGE_KEY_PREFIX}${caregiverId}`;

    async function register() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Explicitly register the SW so Firebase uses our registration instead of
        // trying to auto-register it internally (which times out in Vite dev and
        // in some production setups where the SW takes time to install).
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        if (!token) return;

        const cachedToken = localStorage.getItem(storageKey);
        if (cachedToken === token) return; // already registered, no change

        await registerPushToken({
          caregiverId,
          fcmToken: token,
          deviceType: 'web',
        });

        localStorage.setItem(storageKey, token);
      } catch (err) {
        // Non-critical enhancement — log for debugging but do not surface to user
        console.error('[PushNotifications] Registration failed:', err);
      }
    }

    register();

    // Show notifications when the app tab is open (foreground).
    // Firebase suppresses the OS popup in foreground, so we trigger it manually
    // via the service worker — keeping the same icon/badge as background messages.
    const unsubscribe = onMessage(messaging, async (payload) => {
      const title = payload.notification?.title ?? 'ParkiCare';
      const body = payload.notification?.body ?? 'You have a new notification.';
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
      });
    });

    return unsubscribe;
  }, [user?.caregiverId]);
}
