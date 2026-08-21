import React from 'react';

interface StreamingGuideProps {
  onBack: () => void;
}

export function StreamingGuide({ onBack }: StreamingGuideProps) {
  const overlayUrl = `${window.location.origin}/#overlay/latest`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          ← Volver
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">📺 Guía de Streaming</h1>
        <p className="text-gray-500 mb-8">Cómo mostrar el marcador en vivo durante una transmisión por Twitch.</p>

        {/* URL del overlay */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-2">URL del Overlay</h2>
          <p className="text-xs text-gray-500 mb-3">Este es el enlace que debes poner como Browser Source en OBS o PRISM:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-800 font-mono break-all">
              {overlayUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(overlayUrl)}
              className="shrink-0 px-3 py-3 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Copiar
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            El overlay detecta automáticamente el partido en vivo con prioridad y muestra el tema seleccionado.
          </p>
        </div>

        {/* Opción 1: PRISM (celular) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Opción 1: PRISM Live Studio (Celular)</h2>
          <p className="text-xs text-emerald-700 font-medium mb-3">Recomendado — stream directo desde el celular</p>

          <ol className="text-sm text-gray-700 space-y-2.5 list-decimal list-inside">
            <li>Descargar <strong>PRISM Live Studio</strong> desde App Store / Play Store</li>
            <li>Crear cuenta y conectar tu canal de Twitch</li>
            <li>En la pantalla de transmisión, agregar una capa <strong>"Web"</strong> (Browser)</li>
            <li>Pegar la URL del overlay: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{overlayUrl}</code></li>
            <li>Ajustar el tamaño de la capa para que ocupe el ancho completo abajo</li>
            <li>Iniciar transmisión — el marcador aparece automáticamente cuando hay un partido en vivo</li>
          </ol>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              ⚠️ <strong>PRISM tiene prueba gratuita de 2 semanas.</strong> Después aparece marca de agua.
              Para uso continuo, considerar OBS desde computador.
            </p>
          </div>
        </div>

        {/* Opción 2: OBS (computador) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Opción 2: OBS Studio (Computador)</h2>
          <p className="text-xs text-blue-700 font-medium mb-3">Gratis y sin marca de agua — requiere computador</p>

          <ol className="text-sm text-gray-700 space-y-2.5 list-decimal list-inside">
            <li>Descargar <strong>OBS Studio</strong> desde <a href="https://obsproject.com" target="_blank" rel="noopener" className="text-blue-600 underline">obsproject.com</a> (gratis)</li>
            <li>Conectar con Twitch: Configuración → Stream → Servicio: Twitch → Conectar cuenta</li>
            <li>En "Sources" (Fuentes), click <strong>"+" → Browser</strong></li>
            <li>En URL pegar: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{overlayUrl}</code></li>
            <li>Dimensiones: <strong>Width: 1920, Height: 1080</strong></li>
            <li>Posicionar la fuente para que el marcador quede abajo de la pantalla</li>
            <li>La cámara (celular o webcam) va como otra fuente detrás del overlay</li>
            <li>Click "Iniciar transmisión"</li>
          </ol>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              💡 <strong>Tip:</strong> Si usas cámara de celular en OBS, instala <strong>DroidCam</strong> (Android)
              o usa la cámara de continuidad de iPhone.
            </p>
          </div>
        </div>

        {/* Configuración del marcador */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Configuración del Marcador</h2>

          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="text-emerald-600 mt-0.5 shrink-0">1.</span>
              <span>Inicia un partido "En Vivo" desde la web (Marcador → seleccionar partido → Iniciar)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-600 mt-0.5 shrink-0">2.</span>
              <span>En el <strong>Panel de Edición</strong> (⚙️), selecciona el color/tema del overlay</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-600 mt-0.5 shrink-0">3.</span>
              <span>Si hay más de un partido en vivo, dale <strong>prioridad</strong> al que quieres mostrar en el stream</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-600 mt-0.5 shrink-0">4.</span>
              <span>El overlay se actualiza cada 2 segundos automáticamente — no necesitas hacer nada más</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-600 mt-0.5 shrink-0">5.</span>
              <span>Puedes cambiar el tema en cualquier momento durante el partido</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Notas</h2>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li>• El overlay tiene fondo semi-transparente — se ve lo que hay detrás</li>
            <li>• Si no hay partido en vivo, el overlay muestra un placeholder con el logo PPC</li>
            <li>• El tema se puede cambiar en caliente sin reiniciar el stream</li>
            <li>• Múltiples partidos pueden estar en vivo a la vez, pero solo uno se muestra en el overlay (el que tiene prioridad)</li>
            <li>• La URL del overlay es siempre la misma — no cambia entre partidos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
