import { useState, useEffect, useCallback } from 'react';
import { parseGvizResponse, buildPaymentMap } from '../lib/paymentUtils';
import type { PaymentStatusMap } from '../types/payment';

const GVIZ_URL =
  'https://docs.google.com/spreadsheets/d/1DC64PmiKF7yerp59-PT0fnEGcU0xSW7Dm500PyBtJWg/gviz/tq?tqx=out:json&sheet=pagos_web';

export interface UsePaymentStatusResult {
  paymentMap: PaymentStatusMap;
  loading: boolean;
  error: string | null;
  reportPayment: (profileId: string, torneo: string) => Promise<void>;
  reporting: boolean;
  reportError: string | null;
}

export function usePaymentStatus(torneoName: string | null): UsePaymentStatusResult {
  const [paymentMap, setPaymentMap] = useState<PaymentStatusMap>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (!torneoName) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(GVIZ_URL)
      .then((res) => res.text())
      .then((raw) => {
        if (cancelled) return;
        const rows = parseGvizResponse(raw);
        const map = buildPaymentMap(rows, torneoName);
        setPaymentMap(map);
      })
      .catch(() => {
        if (cancelled) return;
        // Silently fail — table renders without payment icons
        setError('No se pudo cargar el estado de pagos');
        setPaymentMap(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [torneoName]);

  const reportPayment = useCallback(
    async (profileId: string, torneo: string): Promise<void> => {
      setReporting(true);
      setReportError(null);

      try {
        const res = await fetch('/api/sheets-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: profileId, torneo }),
        });

        console.log('[PaymentStatus] POST /api/sheets-update response:', res.status, res.statusText);

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          console.error('[PaymentStatus] Non-JSON response:', text.slice(0, 200));
          throw new Error('El servidor no respondió correctamente. ¿Estás usando vercel dev?');
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? 'Error al registrar el pago');
        }

        const data = await res.json();
        console.log('[PaymentStatus] Success:', data);

        // Optimistic update — no need to re-fetch the sheet
        setPaymentMap((prev) => {
          const next = new Map(prev);
          next.set(profileId, 'pagado_sin_validar');
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al registrar el pago';
        setReportError(message);
      } finally {
        setReporting(false);
      }
    },
    [],
  );

  return { paymentMap, loading, error, reportPayment, reporting, reportError };
}
