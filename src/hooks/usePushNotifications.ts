import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

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

  // Check current state on mount + auto-resync (renueva la sub en DB si el permiso
  // ya está concedido). Esto evita que las suscripciones queden "stale": cada vez
  // que el jugador abre la web, su suscripción se regenera y se re-guarda en la DB.
  useEffect(() => {
    if (!isSupported) {
      setPermission('denied');
      return;
    }

    setPermission(Notification.permission);

    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setIsSubscribed(!!existing);

      // Auto-resync solo si el usuario YA concedió permiso y hay profileId.
      if (Notification.permission !== 'granted' || !profileId || !VAPID_PUBLIC_KEY) return;

      try {
        // Reutiliza la sub existente o crea una nueva si el navegador la rotó/eliminó.
        const subscription =
          existing ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }));

        // Re-guarda en DB (idempotente por endpoint). Así se regenera la fila si
        // había sido borrada por un 410, o se actualiza si el endpoint cambió.
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            profile_id: profileId,
            subscription: subscription.toJSON(),
            user_agent: navigator.userAgent,
          }),
        });
        setIsSubscribed(true);
      } catch {
        // Silencioso: si falla el resync, el usuario puede reactivar manualmente.
      }
    }).catch(() => {});
  }, [isSupported, profileId]);

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
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
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
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
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
