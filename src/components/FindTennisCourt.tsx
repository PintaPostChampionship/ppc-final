import * as React from "react";

export default function FindTennisCourt({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-full bg-gradient-to-br from-emerald-50 via-white to-gray-100 py-10 px-4">
      <div className="w-full max-w-5xl mx-auto">

        {/* Título */}
        <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-emerald-800 mb-8">
          Tips para encontrar y reservar canchas 🎾
        </h2>

        {/* Tips originales */}
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: "🎟️",
                title: "Usen membresías",
                text: "Saquen membresía en canchas donde juegan seguido (o pregunten en el grupo). Les permite agendar con hasta 1 semana de anticipación.",
              },
              {
                icon: "⏰",
                title: "Reservar apenas vean horas",
                text: "En muchas canchas pueden cancelar con 24 h (o menos). Reserven temprano y ajusten luego.",
              },
              {
                icon: "🔁",
                title: "Revisar 24 h antes",
                text: "Se liberan muchas horas por cancelaciones el día previo. Revisen varias veces: mañana/tarde/noche.",
              },
              {
                icon: "👥",
                title: "Coordinen en equipo",
                text: "Pónganse de acuerdo para que ambos revisen durante la semana y tengan claras varias opciones.",
              },
            ].map((tip, i) => (
              <article
                key={i}
                className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{tip.icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-900">{tip.title}</h3>
                    <p className="mt-1 text-sm text-emerald-800/80 leading-snug">{tip.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Tips del Buscador 2.0 */}
        <section className="mb-10">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Cómo usar el Buscador 2.0
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: "📍",
                title: "Buscar canchas cercanas",
                text: "El buscador usa tu ubicación para mostrar las canchas más cercanas primero. Permite la ubicación cuando te lo pida.",
              },
              {
                icon: "📅",
                title: "Filtrar por fecha y hora",
                text: "Usa los filtros de fecha (día específico o todos) y bloque horario (mañana/tarde/noche) para ver solo lo que te sirve.",
              },
              {
                icon: "🔔",
                title: "Activar notificaciones",
                text: "Si no hay disponibilidad en la hora que quieres, crea una alerta. Te avisaremos por push o email cuando se libere una cancha.",
              },
              {
                icon: "🗺️",
                title: "Usar el mapa",
                text: "El mapa muestra todas las canchas con la cantidad de slots disponibles. Haz click en un marcador para ver los detalles.",
              },
            ].map((tip, i) => (
              <article
                key={i}
                className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{tip.icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">{tip.title}</h3>
                    <p className="mt-1 text-sm text-blue-800/80 leading-snug">{tip.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          Pinta Post Championship© {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
