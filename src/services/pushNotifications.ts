import api from '@/lib/api';

export interface PushSubscriptionPayload {
  caregiverId: number;
  fcmToken: string;
  deviceId: string;
  deviceType: string;
}

export async function registerPushToken(payload: PushSubscriptionPayload): Promise<void> {
  await api.post('/push/subscribe', payload);
}

export async function unregisterPushToken(fcmToken: string): Promise<void> {
  await api.delete('/push/unsubscribe', { params: { fcmToken } });
}
