import type { PaymentStatus } from '../types/payment';

interface PaymentStatusIconProps {
  status: PaymentStatus | undefined;
}

export function PaymentStatusIcon({ status }: PaymentStatusIconProps): JSX.Element | null {
  if (status === 'pendiente') {
    return (
      <span title="Cuota pendiente de pago" className="text-base leading-none">
        💰
      </span>
    );
  }
  if (status === 'pagado_sin_validar' || status === 'pagado') {
    return (
      <span title="Cuota pagada" className="text-base leading-none">
        ✅
      </span>
    );
  }
  return null;
}
