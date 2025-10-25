import * as React from "react";

/** Tarjeta de app recomendada (tipada para TS) */
type AppCardProps = {
  href: string;
  name: string;
  desc: string;
  color: string;  // clases tailwind del gradient: "from-emerald-100 to-emerald-50", etc.
  logo?: string;  // ruta a imagen (png/jpg/svg) en /public/images
  icon?: string;  // emoji fallback si no hay logo
};

function AppCard({ href, name, desc, color, logo, icon }: AppCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group rounded-2xl border border-gray-200 bg-gradient-to-br ${color} p-5 flex flex-col items-center text-center hover:shadow-md transition`}
    >
      {logo ? (
        <img
          src={logo}
          alt={name}
          className="h-12 w-12 rounded-md object-contain bg-white p-1 mb-3 shadow-sm"
        />
      ) : (
        <div className="h-12 w-12 mb-3 rounded-md bg-white grid place-items-center text-2xl">
          {icon}
        </div>
      )}
      <div className="font-semibold text-gray-900">{name}</div>
      <div className="text-xs text-gray-700 mt-1">{desc}</div>
    </a>
  );
}

export default function FindTennisCourt() {
  const [embedLoaded, setEmbedLoaded] = React.useState(false);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gray-100 py-10 px-4">
      <div className="w-full max-w-5xl mx-auto">
        {/* Título principal */}
        <h1 className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-emerald-800 mb-10">
          Encuentra y agenda tu próxima cancha 🎾
        </h1>

        {/* === TIPS === */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Tips para agendar canchas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: "🎟️",
                title: "Usen membresías",
                text:
                  "Saquen membresía en canchas donde juegan seguido (o pregunten en el grupo). Les permite agendar con hasta 1 semana de anticipación.",
              },
              {
                icon: "⏰",
                title: "Reservar apenas vean horas",
                text:
                  "En muchas canchas pueden cancelar con 24 h (o menos). Reserven temprano y ajusten luego.",
              },
              {
                icon: "🔁",
                title: "Revisar 24 h antes",
                text:
                  "Se liberan muchas horas por cancelaciones el día previo. Revisen varias veces: mañana/tarde/noche.",
              },
              {
                icon: "👥",
                title: "Coordinen en equipo",
                text:
                  "Pónganse de acuerdo para que ambos revisen durante la semana y tengan claras varias opciones.",
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

        {/* === IFRAME === */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold text-gray-800">Buscador de canchas</h3>
            <a
              href="https://localtenniscourts.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
            >
              Abrir en nueva pestaña ↗
            </a>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-emerald-100 shadow-sm bg-white">
            {!embedLoaded && (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-emerald-50 to-gray-100">
                <span className="animate-pulse text-sm text-gray-600">Cargando buscador…</span>
              </div>
            )}
            <iframe
              src="https://localtenniscourts.com/"
              title="Local Tennis Courts"
              className="w-full h-[75vh]"
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setEmbedLoaded(true)}
            />
          </div>
        </section>

        {/* === APPS RECOMENDADAS (orden solicitado) === */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Aplicaciones recomendadas 📱
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {/* 1️⃣ Tiebreak (.jpg) */}
            <AppCard
              href="https://tiebreak.io/"
              logo="/tiebreak-logo.jpeg"
              name="Tiebreak"
              desc="Reserva rápida en clubes y centros de Londres"
              color="from-emerald-100 to-emerald-50"
            />

            {/* 2️⃣ SPIN (.png) */}
            <AppCard
              href="https://www.spinapp.co.uk/"
              logo="/spin-logo.png"
              name="SPIN"
              desc="Juega en grupos y partidos sociales cerca de ti"
              color="from-yellow-50 to-emerald-50"
            />

            {/* 3️⃣ LTA Rally (.svg) */}
            <AppCard
              href="https://www.lta.org.uk/rally/"
              logo="/lta-logo.svg"
              name="LTA Rally"
              desc="Reservas y clubes asociados (Lawn Tennis Association)"
              color="from-blue-50 to-emerald-50"
            />

            {/* 4️⃣ Playfinder (emoji) */}
            <AppCard
              href="https://www.playfinder.com/london/tennis"
              icon="📍"
              name="Playfinder"
              desc="Canchas públicas y privadas en Londres"
              color="from-emerald-50 to-gray-50"
            />

            {/* 5️⃣ Better (emoji) */}
            <AppCard
              href="https://www.better.org.uk/tennis"
              icon="🏟️"
              name="Better (GLL)"
              desc="Centros municipales con tenis"
              color="from-gray-50 to-emerald-50"
            />
          </div>
        </section>

        {/* Footer pequeño */}
        <p className="text-center text-xs text-gray-500 mt-8">
          Pinta Post Championship© {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
