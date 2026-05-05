import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'loading';
  isSubscribed: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications(profileId: string | null): UsePushNotificationsReturn {
  const [isSupported] = useState(() =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
  const [permission, setPermission] = useState<NotificationPermission | 'loading'>('loading');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check current state on mount
  useEffect(() => {
    if (!isSupported) {
      setPermission('denied');
      return;
    }

    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    }).catch(() => {});
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !profileId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setError('Permiso de notificaciones denegado');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send to backend
      const response = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          subscription: subscription.toJSON(),
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar la suscripción');
      }

      setIsSubscribed(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al activar notificaciones';
      setError(message);
      console.error('[usePushNotifications] subscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, profileId]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !profileId) return;
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from backend
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: profileId,
            endpoint: subscription.endpoint,
          }),
        });
      }

      setIsSubscribed(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al desactivar notificaciones';
      setError(message);
      console.error('[usePushNotifications] unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, profileId]);

  return {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe,
    isLoading,
    error,
  };
}
