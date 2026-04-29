interface PaymentModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function PaymentModal({
  isOpen,
  onConfirm,
  onCancel,
  isSubmitting,
  error,
}: PaymentModalProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Confirmar pago
        </h3>
        <p className="text-gray-700 mb-4 text-sm leading-relaxed">
          ¿Estás seguro que pagaste a la cuenta de{' '}
          <span className="font-semibold">Daniel Sepulveda</span>?
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Monto</span>
            <span className="font-mono font-semibold text-gray-900">£45</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Account number</span>
            <span className="font-mono font-semibold text-gray-900">71906880</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Sort code</span>
            <span className="font-mono font-semibold text-gray-900">23-08-01</span>
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Registrando...' : 'Sí, pagué'}
          </button>
        </div>
      </div>
    </div>
  );
}
