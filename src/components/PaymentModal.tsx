import * as React from "react";

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

  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const copyAll = () => {
    const text = `Daniel Sepulveda\nAccount: 71906880\nSort code: 23-08-01\nMonto: £45`;
    copyToClipboard(text, 'all');
  };

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
          ¿Estás seguro que pagaste a la cuenta correcta?
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-2 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div><span className="text-gray-500">Nombre: </span><span className="font-semibold text-gray-900">Daniel Sepulveda</span></div>
            <button onClick={() => copyToClipboard('Daniel Sepulveda', 'nombre')} className="text-xs text-gray-400 hover:text-emerald-600 transition px-1.5 py-0.5 rounded hover:bg-emerald-50">
              {copiedField === 'nombre' ? '✓' : '📋'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div><span className="text-gray-500">Account: </span><span className="font-mono font-semibold text-gray-900">71906880</span></div>
            <button onClick={() => copyToClipboard('71906880', 'account')} className="text-xs text-gray-400 hover:text-emerald-600 transition px-1.5 py-0.5 rounded hover:bg-emerald-50">
              {copiedField === 'account' ? '✓' : '📋'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div><span className="text-gray-500">Sort code: </span><span className="font-mono font-semibold text-gray-900">23-08-01</span></div>
            <button onClick={() => copyToClipboard('230801', 'sort')} className="text-xs text-gray-400 hover:text-emerald-600 transition px-1.5 py-0.5 rounded hover:bg-emerald-50">
              {copiedField === 'sort' ? '✓' : '📋'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div><span className="text-gray-500">Monto: </span><span className="font-mono font-semibold text-gray-900">£45</span></div>
            <button onClick={() => copyToClipboard('45', 'monto')} className="text-xs text-gray-400 hover:text-emerald-600 transition px-1.5 py-0.5 rounded hover:bg-emerald-50">
              {copiedField === 'monto' ? '✓' : '📋'}
            </button>
          </div>
        </div>

        <button
          onClick={copyAll}
          className="w-full mb-5 px-3 py-1.5 text-xs text-gray-500 hover:text-emerald-600 transition flex items-center justify-center gap-1"
        >
          {copiedField === 'all' ? '✓ Copiado' : '📋 Copiar todos'}
        </button>

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
