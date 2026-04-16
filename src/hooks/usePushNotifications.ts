import { useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase';
import { registerPushToken } from '@/services/pushNotifications';
import { fetchPendingRemindersForCaregiver } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useMedicationAlert, type MedicationAlert } from '@/context/MedicationAlertContext';

const VAPID_KEY = 'BO-VIv4NIIiqsoHglpLaLT6oVsRTmqXW8bV3CvotCOs677zl8M0pytv26Wi61lKvaQmDxo4nhNdGBHkE9fGS6W4';

const STORAGE_KEY_PREFIX = 'fcm_token_';
const DEVICE_ID_STORAGE_KEY = 'pc_device_id';
const ALERT_STORAGE_KEY = 'pc_pending_medication_alert';
const ALERT_TTL_MS = 12 * 60 * 60 * 1000; // 12h safety window

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

function normalizeAlert(input: any): MedicationAlert | null {
  console.log('[PushNotifications] normalizeAlert input:', JSON.stringify(input));
  const remindId = input?.remindId ?? input?.data?.remindId;
  const caregiverId = input?.caregiverId ?? input?.data?.caregiverId;
  const title = input?.title ?? input?.data?.title ?? input?.notification?.title ?? 'ParkiCare';
  const body = input?.body ?? input?.data?.body ?? input?.notification?.body ?? 'Medication reminder.';

  if (!remindId || !caregiverId) {
    console.warn('[PushNotifications] normalizeAlert returned null - missing remindId or caregiverId.', { remindId, caregiverId });
    return null;
  }

  const result = {
    remindId: String(remindId),
    caregiverId: String(caregiverId),
    title: String(title),
    body: String(body),
  };
  console.log('[PushNotifications] normalizeAlert result:', JSON.stringify(result));
  return result;
}

function persistAlert(alert: MedicationAlert) {
  localStorage.setItem(
    ALERT_STORAGE_KEY,
    JSON.stringify({
      ...alert,
      receivedAt: Date.now(),
    }),
  );
}

function consumeStoredAlert(): MedicationAlert | null {
  const raw = localStorage.getItem(ALERT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.receivedAt || Date.now() - parsed.receivedAt > ALERT_TTL_MS) {
      localStorage.removeItem(ALERT_STORAGE_KEY);
      return null;
    }

    const alert = normalizeAlert(parsed);

    // One-shot replay: remove once consumed so it does not re-open forever.
    localStorage.removeItem(ALERT_STORAGE_KEY);

    return alert;
  } catch {
    localStorage.removeItem(ALERT_STORAGE_KEY);
    return null;
  }
}

export function usePushNotifications() {
  const { user } = useAuth();
  const { dispatchAlert } = useMedicationAlert();

  const dispatchAndPersist = useCallback(
    (alert: MedicationAlert) => {
      console.log('[PushNotifications] dispatchAndPersist called:', JSON.stringify(alert));
      persistAlert(alert);
      dispatchAlert(alert);
    },
    [dispatchAlert],
  );

  useEffect(() => {
    if (!user?.caregiverId) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const caregiverId = user.caregiverId;
    const storageKey = `${STORAGE_KEY_PREFIX}${caregiverId}`;
    const deviceId = getOrCreateDeviceId();

    async function register() {
      try {
        console.log('[PushNotifications] Starting registration. Permission:', Notification.permission);
        if (Notification.permission === 'denied') {
          console.warn('[PushNotifications] Permission denied - aborting registration.');
          return;
        }
        const permission =
          Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();

        console.log('[PushNotifications] Permission result:', permission);
        if (permission !== 'granted') return;

        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('[PushNotifications] Service worker registered:', swReg.scope, '| State:', swReg.active?.state);

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        console.log('[PushNotifications] FCM token obtained:', token ? token.slice(0, 20) + '...' : 'NULL');
        if (!token) return;

        const cachedToken = localStorage.getItem(storageKey);
        if (cachedToken === token) {
          console.log('[PushNotifications] Token unchanged - skipping registerPushToken API call.');
          return;
        }

        await registerPushToken({
          caregiverId,
          fcmToken: token,
          deviceId,
          deviceType: 'web',
        });
        console.log('[PushNotifications] registerPushToken API call succeeded.');

        localStorage.setItem(storageKey, token);
      } catch (err) {
        console.error('[PushNotifications] Registration failed:', err);
      }
    }

    register();

    // Replay alert when tab becomes active again.
    const replayStoredAlert = (source: string) => {
      console.log('[PushNotifications] replayStoredAlert triggered from:', source);
      const pending = consumeStoredAlert();
      console.log('[PushNotifications] replayStoredAlert - stored alert:', pending ? JSON.stringify(pending) : 'none');
      if (pending) dispatchAlert(pending);
    };

    replayStoredAlert('mount');

    const onWindowFocus = () => replayStoredAlert('window focus');
    const onVisibility = () => {
      if (!document.hidden) replayStoredAlert('visibilitychange');
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibility);

    // Foreground FCM path
    console.log('[PushNotifications] Registering onMessage (foreground FCM) listener.');
    const unsubscribe = onMessage(messaging, async (payload) => {
      console.log('[PushNotifications] onMessage fired! Full payload:', JSON.stringify(payload));
      try {
        // Try to build the alert from FCM data fields first.
        // FCM Web Push often strips data fields, so fall back to fetching
        // pending reminders from the API when remindId/caregiverId are absent.
        let alert = normalizeAlert({
          remindId: payload.data?.remindId,
          caregiverId: payload.data?.caregiverId,
          title: payload.data?.title ?? payload.notification?.title,
          body: payload.data?.body ?? payload.notification?.body,
        });

        if (!alert) {
          console.log('[PushNotifications] onMessage - FCM data missing, fetching pending reminders from API...');
          const pending = await fetchPendingRemindersForCaregiver(caregiverId);
          console.log('[PushNotifications] onMessage - API returned', pending.length, 'pending reminder(s):', JSON.stringify(pending));
          const first = pending[0];
          if (first) {
            alert = {
              remindId: String(first.remindId),
              caregiverId: String(caregiverId),
              title: payload.notification?.title ?? 'Medication Reminder',
              body: payload.notification?.body ?? 'Time to take medication.',
            };
            console.log('[PushNotifications] onMessage - built alert from API:', JSON.stringify(alert));
          } else {
            console.warn('[PushNotifications] onMessage - no pending reminders found, cannot show in-app alert.');
          }
        }

        console.log('[PushNotifications] onMessage - final alert:', alert ? JSON.stringify(alert) : 'NULL');
        if (alert) dispatchAndPersist(alert);
      } catch (err) {
        console.error('[PushNotifications] onMessage handler error:', err);
      }
    });

    // Background bridge: BroadcastChannel
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('parkicare-alerts');
      console.log('[PushNotifications] BroadcastChannel listener registered.');
      broadcastChannel.onmessage = (event: MessageEvent) => {
        console.log('[PushNotifications] BroadcastChannel message received:', JSON.stringify(event.data));
        const type = event.data?.type;
        if (type === 'MEDICATION_ALERT') {
          const alert = normalizeAlert(event.data);
          console.log('[PushNotifications] BroadcastChannel - alert after normalize:', alert ? JSON.stringify(alert) : 'NULL');
          if (alert) dispatchAndPersist(alert);
        } else if (type === 'NOTIFICATION_RECEIVED') {
          // FCM stripped data fields - fetch pending reminder from API.
          console.log('[PushNotifications] BroadcastChannel - NOTIFICATION_RECEIVED, fetching from API...');
          fetchPendingRemindersForCaregiver(caregiverId).then((pending) => {
            console.log('[PushNotifications] BroadcastChannel - API returned', pending.length, 'pending reminder(s)');
            const first = pending[0];
            if (first) {
              const alert: MedicationAlert = {
                remindId: String(first.remindId),
                caregiverId: String(caregiverId),
                title: event.data.title ?? 'Medication Reminder',
                body: event.data.body ?? 'Time to take medication.',
              };
              console.log('[PushNotifications] BroadcastChannel - dispatching alert from API:', JSON.stringify(alert));
              dispatchAndPersist(alert);
            } else {
              console.warn('[PushNotifications] BroadcastChannel - no pending reminders found from API.');
            }
          }).catch((err) => {
            console.error('[PushNotifications] BroadcastChannel - API fetch failed:', err);
          });
        } else {
          console.warn('[PushNotifications] BroadcastChannel - unexpected type, ignoring:', type);
        }
      };
    } catch (e) {
      console.warn('[PushNotifications] BroadcastChannel unavailable:', e);
    }

    // Background bridge: service worker postMessage (more reliable on some browsers)
    const onServiceWorkerMessage = (event: MessageEvent) => {
      console.log('[PushNotifications] serviceWorker.onmessage received:', JSON.stringify(event.data));
      const type = event.data?.type;
      if (type === 'MEDICATION_ALERT') {
        const alert = normalizeAlert(event.data);
        console.log('[PushNotifications] serviceWorker.onmessage - alert after normalize:', alert ? JSON.stringify(alert) : 'NULL');
        if (alert) dispatchAndPersist(alert);
      } else if (type === 'NOTIFICATION_RECEIVED') {
        // FCM stripped data fields - fetch pending reminder from API.
        console.log('[PushNotifications] serviceWorker.onmessage - NOTIFICATION_RECEIVED, fetching from API...');
        fetchPendingRemindersForCaregiver(caregiverId).then((pending) => {
          console.log('[PushNotifications] serviceWorker.onmessage - API returned', pending.length, 'pending reminder(s)');
          const first = pending[0];
          if (first) {
            const alert: MedicationAlert = {
              remindId: String(first.remindId),
              caregiverId: String(caregiverId),
              title: event.data.title ?? 'Medication Reminder',
              body: event.data.body ?? 'Time to take medication.',
            };
            console.log('[PushNotifications] serviceWorker.onmessage - dispatching alert from API:', JSON.stringify(alert));
            dispatchAndPersist(alert);
          } else {
            console.warn('[PushNotifications] serviceWorker.onmessage - no pending reminders found from API.');
          }
        }).catch((err) => {
          console.error('[PushNotifications] serviceWorker.onmessage - API fetch failed:', err);
        });
      } else {
        console.warn('[PushNotifications] serviceWorker.onmessage - unexpected type, ignoring:', type);
      }
    };

    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);

    return () => {
      unsubscribe();
      broadcastChannel?.close();
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.caregiverId, dispatchAlert, dispatchAndPersist]);
}