# ppc-final — Contexto del proyecto

Web oficial del **PPC (Pinta Post Championship)**, una liga de tenis amateur entre amigos en Londres. Desplegada en Vercel, con Supabase como backend.

URL: **ppctennis.vercel.app**

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript 5.8 + Vite 7 |
| Estilos | Tailwind CSS 3.4 (plugins: forms, aspect-ratio, typography) |
| Backend | Supabase (PostgreSQL + Realtime + Auth + Storage) |
| Serverless | Vercel Functions (Node.js 20.x) |
| Testing | Vitest + fast-check + @testing-library/react |

---

## Estructura del proyecto

```
ppc-final/
├── src/
│   ├── App.tsx                          # Componente principal (orquestador, ~10000 líneas)
│   ├── lib/
│   │   ├── supabaseClient.ts            # Cliente Supabase (VITE_SUPABASE_URL + ANON_KEY)
│   │   ├── paymentUtils.ts              # Funciones puras: parseo Google Sheets, mapa de pagos
│   │   ├── notificationUtils.ts         # Funciones puras: builders de payload, filtros, calendar URL
│   │   ├── dateUtils.ts                 # Funciones de fecha (formatISOToDDMMYYYY, parseYMDLocal, etc.)
│   │   ├── playerUtils.ts              # Estadísticas de jugadores (getPlayerStatsSummaryAll, etc.)
│   │   ├── displayUtils.ts             # Helpers de display (toTitleCase, uiName, divisionColors, etc.)
│   │   ├── imageUtils.ts               # Helpers de imagen (avatarSrc, resizeImage, etc.)
│   │   ├── onboardingUtils.ts          # Helpers de onboarding (savePending, loadPending, etc.)
│   │   ├── tournamentUtils.ts          # Clasificación de torneos (isCalibration, isOfficial)
│   │   └── constants.ts                # Constantes (BOOKING_VENUES, highlightPhotos, etc.)
│   ├── hooks/
│   │   ├── usePaymentStatus.ts          # Hook de estado de pagos (fetch gviz + reportPayment)
│   │   └── usePushNotifications.ts      # Hook de notificaciones push (subscribe/unsubscribe)
│   ├── types/
│   │   ├── index.ts                     # Todos los tipos compartidos (Profile, Match, Tournament, etc.)
│   │   └── payment.ts                   # PaymentStatus, PaymentStatusMap, PagosWebRow
│   ├── components/
│   │   ├── BuscarClases.tsx             # Buscador de clases de tenis (weekly board)
│   │   ├── FindTennisCourt.tsx          # Guía para encontrar canchas + apps recomendadas
│   │   ├── PaymentModal.tsx             # Modal de confirmación de pago de cuota
│   │   ├── PaymentStatusIcon.tsx        # Ícono 💰/✅ según estado de pago
│   │   ├── PlayerShowcaseCard.tsx       # Ficha de jugador estilo carta de tenista
│   │   ├── BracketView.tsx             # Vista de bracket knockout (R16→QF→SF→F)
│   │   ├── NavPlayerSearch.tsx          # Buscador de jugadores en el menú
│   │   ├── NavTournamentsSection.tsx    # Sección de torneos en el menú
│   │   └── LiveScoreboard/
│   │       ├── LiveScoreboard.tsx       # Componente principal del marcador en vivo
│   │       ├── LiveScoreDisplay.tsx     # Display visual del marcador (estilo PPC)
│   │       ├── LiveMatchBanner.tsx      # Banner de partidos en vivo en la home
│   │       ├── useLiveScore.ts          # Hook: estado + Realtime + persistencia
│   │       └── liveScoreUtils.ts        # Lógica pura de puntuación (sin React)
│   └── __tests__/                       # Tests (property-based + unit)
├── api/
│   ├── push-subscribe.ts               # POST/DELETE: gestionar suscripciones push
│   ├── send-notification.ts            # POST: enviar notificación push a un jugador
│   ├── sheets-update.ts                # POST: registra pago en Google Sheets (JWT)
│   ├── telegram.ts                      # Webhook: bot Telegram → dispatch GitHub Actions
│   ├── cron/
│   │   └── daily-reminders.ts          # Cron diario: recordatorios post-partido
│   └── lib/
│       ├── sheetsLogic.ts               # Funciones puras de validación de pagos
│       └── pushUtils.ts                 # Utilidades compartidas: Supabase service + web-push config
├── public/
│   ├── sw.js                            # Service Worker (push + notificationclick + fetch)
│   ├── site.webmanifest                 # PWA manifest
│   ├── fotos-anteriores/                # Fotos de ediciones pasadas del PPC
│   └── images/                          # Logos de divisiones, assets estáticos
├── .kiro/
│   ├── steering/                        # Archivos de contexto (este archivo, supabase, etc.)
│   └── specs/                           # Specs de features
├── garmin-scoreboard/                   # App Garmin (Monkey C) — Fase 1 offline
├── vercel.json                          # Configuración de cron jobs
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## Features principales

### 1. Gestión de torneos y divisiones
- Torneos con temporadas (PPC 1, PPC 2, etc.), estados: `active`, `finished`, `upcoming`
- Divisiones jerárquicas: Cobre, Plata, Oro (con colores, capacidad, slots de ascenso/descenso)
- Tabla de posiciones con ranking, victorias, derrotas, puntos, games
- Inscripción de jugadores a torneos/divisiones
- Soporte para torneos de calibración y formato knockout (bracket view)

### 2. Partidos y resultados
- Programación de partidos con fecha, hora, ubicación
- Carga de resultados set por set (match_sets)
- Anécdotas de partidos (máx 50 palabras)
- Tracking de pintas 🍺 (tradición PPC)
- Edición de resultados y reprogramación
- Notificaciones de partidos pendientes

### 3. Live Scoreboard (en desarrollo)
- Marcador en tiempo real con Supabase Realtime
- Formatos: Standard, NextGen, SuperTiebreak
- Punto a punto con undo (historial en memoria)
- Compartir por link o WhatsApp (`/#live/match/:id`)
- Banner de partidos en vivo en la home
- Al finalizar, guarda resultado automáticamente en `matches` + `match_sets`

### 4. Perfiles de jugadores
- Ficha completa: nombre, nickname, avatar, código postal
- Player Card estilo carta de tenista (edad, nacionalidad, mano dominante, raqueta, etc.)
- Disponibilidad por día/hora/ubicación
- Estadísticas: partidos jugados, ganados, perdidos, racha, rival más frecuente
- Historial de torneos y divisiones

### 5. Reserva automática de canchas (bot)
- Panel de booking integrado en la web (solo admins/bookers)
- Formulario para crear solicitudes de reserva
- Venues configurados: Highbury Fields (11 canchas), Rosemary Gardens (2 canchas)
- Estado de solicitudes: PENDING → SEARCHING → BOOKED / FAILED / EXPIRED
- Conectado con `court_booking_requests` en Supabase → leído por bot en `book-better-bot`

### 6. Buscar clases de tenis (vista privada)
- Fetch de `tennis_sessions.json` desde repo privado `booking_ppc` via GitHub API
- Weekly board con filtros: tipo (drill/1x1), plataforma (Flow/Better/ClubSpark), nivel
- Tarjetas con venue, hora, precio, disponibilidad, link de booking
- Solo visible para profile ID autorizado: `fb045715-86c6-48fc-88dc-c784fa5ed2bc`

### 7. Encontrar cancha (guía)
- Iframe embebido de localtenniscourts.com
- Tips para reservar canchas en Londres
- Apps recomendadas: Tiebreak, SPIN, LTA Rally, Playfinder, Better

### 8. Sistema de pagos de cuota
- Lee estado de pagos desde Google Sheets (endpoint gviz público)
- Tres estados: `pendiente` (💰), `pagado_sin_validar` (✅), `pagado` (✅)
- Botón "Ya pagué" para auto-reportar → Vercel Function actualiza Google Sheets
- Integrado en la tabla de divisiones con íconos de estado

### 9. Eventos sociales
- Tabla `social_events` para cenas, celebraciones, etc.
- Título, descripción, fecha, venue, imagen, link RSVP

### 10. Bot de Telegram
- Webhook en `/api/telegram` para ejecutar comandos remotos
- Dispara GitHub Actions workflows en repos `ppc-final` y `booking_ppc`
- Comandos: `ppc: instrucción` o `booking: instrucción`
- Flags: `--readonly`, `--nopr`

---

## Navegación

La app NO usa React Router. Toda la navegación es por estado en `App.tsx`:

| Vista | Estado que la controla |
|-------|----------------------|
| Home (lista de torneos) | `!selectedTournament && !selectedPlayer && !showMap && ...` |
| Detalle de torneo | `selectedTournament !== null` |
| Tabla de división | `selectedDivision !== null` |
| Perfil de jugador | `selectedPlayer !== null` |
| Live Scoreboard | `liveMatchId !== null` (hash: `/#live/match/:id`) |
| Encontrar cancha | `showMap === true` |
| Buscar clases | `showBuscarClases === true` |
| Panel de booking | `showBookingPanel === true` |
| Hall of Fame | `showHallOfFameView === true` |
| Torneos históricos | `showHistoricTournaments === true` |

---

## Variables de entorno

### Frontend (.env.local)
```
VITE_SUPABASE_URL=https://tzmbznenarrpjayntyjt.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GITHUB_TOKEN=<GitHub PAT con scope repo>
```

### Vercel (producción)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GITHUB_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_JSON` — credenciales de Google Sheets (JSON string)
- `TELEGRAM_BOT_TOKEN` — token del bot de Telegram
- `TELEGRAM_CHAT_ID` — chat ID autorizado
- `GH_PAT_TOKEN` — GitHub PAT para dispatch de workflows

---

## Patrones de diseño

1. **Todo en App.tsx**: La app es un solo componente gigante (~5000+ líneas). Los componentes extraídos son features independientes (LiveScoreboard, BuscarClases, FindTennisCourt, PaymentModal).
2. **Hash routing**: Solo el Live Scoreboard usa hash (`/#live/match/:id`). El resto es estado de React.
3. **Optimistic updates**: El sistema de pagos actualiza la UI inmediatamente y sincroniza con el servidor.
4. **Funciones puras**: La lógica de puntuación y pagos está separada en archivos sin efectos secundarios.
5. **Supabase Realtime**: El Live Scoreboard se suscribe a cambios en `live_score_state` para sincronizar entre clientes.
6. **Acceso condicional**: Features como "Buscar clases" y el panel de booking están restringidos por profile ID o rol.

---

## Paleta de colores

- **Principal**: Verde esmeralda (`emerald-600` a `emerald-800`)
- **Fondo**: Gradientes de `emerald-50` a `gray-100`
- **Divisiones**: Cada división tiene su color hex (Cobre: `#a16207`, Plata: `#6b7280`, Oro: `#ca8a04`, etc.)
- **Live Scoreboard**: Fondo oscuro verdoso (`#1a3a2a` a `#163320`), acentos amarillo-lima

---

## Comandos de desarrollo

```bash
npm run dev          # Servidor de desarrollo Vite (HMR)
npm run build        # Build de producción
npm run lint         # ESLint
npm test             # Vitest (--run, sin watch)
npm run preview      # Preview del build de producción
```

---

## Specs en desarrollo

| Feature | Estado | Archivo |
|---------|--------|---------|
| Live Scoreboard | 🚧 En progreso | `.kiro/specs/live-scoreboard/` |
| Fee Payment Tracking | 🚧 En progreso | `.kiro/specs/fee-payment-tracking/` |
| App Decomposition | ✅ Completado | `.kiro/specs/app-decomposition/` |
| Push Notifications | ✅ Completado | `.kiro/specs/push-notifications/` |
| Garmin Scoreboard | ✅ Fase 1 (offline) | `garmin-scoreboard/` |

---

## PWA (Progressive Web App)

La web ya está configurada como PWA instalable:
- **Manifest**: `public/site.webmanifest` (nombre, íconos, display standalone)
- **Service Worker**: `public/sw.js` (push notifications + notificationclick + pass-through fetch)
- **Íconos**: `android-chrome-192x192.png`, `android-chrome-512x512.png` + versiones maskable
- **Apple Touch Icon**: `apple-touch-icon.png`
- **Meta tags**: `apple-mobile-web-app-capable`, `theme-color` en `index.html`

Para instalar: abrir ppctennis.vercel.app en Chrome → menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio".

---

## Push Notifications

Sistema de notificaciones push implementado con Web Push API (VAPID):

### Tipos de notificación activos
1. **Partido agendado** → avisa al rival (o ambos si lo agenda el admin) con fecha, hora, lugar + link calendario
2. **Resultado cargado** → avisa al rival (o ambos si lo carga el admin) con marcador set por set
3. **Recordatorio post-partido** → cron diario (10:00 UTC), al día siguiente si no se cargó resultado

### Arquitectura
- **Frontend**: hook `usePushNotifications` + banner opt-in + toggle en menú
- **Service Worker**: `public/sw.js` maneja `push` y `notificationclick`
- **APIs**: `/api/push-subscribe`, `/api/send-notification`, `/api/cron/daily-reminders`
- **DB**: tabla `push_subscriptions` + columna `reminder_sent` en matches
- **Cron**: `vercel.json` con schedule `0 10 * * *`

### Variables de entorno (Vercel)
- `VAPID_PUBLIC_KEY` — clave pública VAPID
- `VAPID_PRIVATE_KEY` — clave privada VAPID
- `VAPID_SUBJECT` — `mailto:pintapostchampionship@gmail.com`
- `VITE_VAPID_PUBLIC_KEY` — misma public key para el frontend
- `CRON_SECRET` — protege el endpoint del cron
- `SUPABASE_URL` — URL de Supabase (sin prefijo VITE_, para server-side)

### Notas
- Cada jugador debe activar notificaciones una vez (banner en la home)
- Si la suscripción no se guardó, desactivar y reactivar desde el menú
- El `mailto:` en VAPID_SUBJECT NO envía correos — es solo identificación del protocolo
- Las notificaciones funcionan en Chrome Android y Safari iOS 16.4+ (PWA instalada)

---

## Roadmap priorizado

### 🔴 Prioridad alta (próximo)

| # | Feature | Descripción | Esfuerzo |
|---|---------|-------------|----------|
| 1 | **Descomponer App.tsx** | Extraer componentes: DivisionTable, PlayerProfile, MatchResultForm, BookingPanel, etc. Sin cambiar funcionalidad. Mejora mantenibilidad futura. | Medio |
| 2 | **Notificaciones push** | Notificar: partido nuevo, resultado cargado, partido en vivo, fecha límite. Ya hay base con Supabase Realtime + service worker. Falta implementar push del navegador + UI de preferencias. | Medio-Alto |
| 3 | **Garmin Fase 2 (sync)** | Conectar la app Garmin con el Live Scoreboard web via HTTP. Vercel Function `/api/live-score` como proxy. | Medio |

### 🟡 Prioridad media (futuro cercano)

| # | Feature | Descripción | Esfuerzo |
|---|---------|-------------|----------|
| 4 | **Dark mode** | Tailwind `dark:` prefix. El Live Scoreboard ya usa fondo oscuro. Resto de la app necesita colores invertidos. | Bajo-Medio |
| 5 | **Buscador de canchas mejorado** | Combinar "Buscar Cancha" + "Buscar Clases" en una sola vista tipo Spin App. Mostrar canchas cercanas por ubicación, disponibilidad, y notificar si se libera una hora. | Alto |
| 6 | **Calendario de partidos** | Vista calendario semanal/mensual con partidos programados. Cada jugador ve los suyos destacados. Compartir a WhatsApp. | Medio |

### 🟢 Prioridad baja (futuro)

| # | Feature | Descripción | Esfuerzo |
|---|---------|-------------|----------|
| 7 | **React Router** | URLs compartibles para torneos, divisiones, perfiles. Botón atrás del navegador. Deep linking. | Alto |
| 8 | **Estadísticas avanzadas** | Rachas (🔥 3 victorias), jugador del mes, evolución por temporada. Más útil cuando haya más historial. | Medio |
| 9 | **ELO Rating** | Ranking numérico global basado en historial de partidos. Predicciones pre-partido. | Medio |

### ❌ Descartado

| Feature | Motivo |
|---------|--------|
| Sistema de challenges | Los jugadores son conocidos y juegan amistosos fuera de la web. Solo partidos oficiales en la plataforma. |

---

## Notas importantes

- **App.tsx es monolítico** (~12,000 líneas): Toda la lógica de torneos, divisiones, partidos, perfiles, booking, etc. está en un solo archivo. El refactor (#1 del roadmap) es incremental — un componente a la vez.
- **Sin React Router**: No hay routing library. Agregar una requeriría un refactor significativo (#7 del roadmap).
- **RLS activo**: Supabase tiene Row Level Security en todas las tablas. La anon key solo lee datos públicos.
- **Storage bucket `avatars`**: Fotos de perfil de jugadores.
- **Carrusel de fotos**: La home tiene un carrusel con fotos de ediciones anteriores del PPC.
- **Onboarding**: Flujo de registro con pasos (nombre, avatar, disponibilidad, torneo, división).
- **Booking venues**: Highbury Fields (11 canchas) y Rosemary Gardens (2 canchas) están hardcodeados en App.tsx.
- **Garmin app**: Código en `garmin-scoreboard/`, compila con SDK 9.1.0 + Java 21. Ver steering `garmin-scoreboard.md` para detalles.
