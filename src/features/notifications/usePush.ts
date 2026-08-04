import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const usePushNotifications = () => {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker
      .getRegistration()
      .then(async (registration) => {
        const subscription = await registration?.pushManager.getSubscription();
        setEnabled(Boolean(subscription));
      })
      .catch(() => undefined);
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    if (!pushSupported()) {
      setError('Notifications are not supported on this device.');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('Push is not configured (missing VAPID key).');
      return;
    }
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was denied.');
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const json = subscription.toJSON();
      const { error: dbError } = await supabase.from('push_subscriptions').upsert(
        {
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
        },
        { onConflict: 'user_id,endpoint' },
      );
      if (dbError) throw dbError;
      setEnabled(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not enable.');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported: pushSupported(),
    configured: Boolean(VAPID_PUBLIC_KEY),
    enabled,
    busy,
    error,
    enable,
    disable,
  };
};
