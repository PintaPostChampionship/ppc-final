---
inclusion: manual
---

# Ideas y Backlog — PPC Tennis

Registro de ideas discutidas, priorizadas por el usuario. Activar con `#ideas-backlog` cuando se quiera revisar o planificar.

---

## 🔴 Prioridad alta (próximo a implementar)

### 1. Descomponer App.tsx
- **Estado**: ✅ Completado
- Extraídos: tipos, 7 módulos de utilidades, constantes, 4 componentes
- App.tsx reducido en ~2000 líneas
- 12 archivos nuevos, 32 tests, build pasa

### 2. Notificaciones push
- **Estado**: ✅ Completado
- ✅ Web Push API con VAPID keys
- ✅ Service Worker (push + notificationclick con hash routing)
- ✅ Hook `usePushNotifications` + banner opt-in + toggle en menú
- ✅ Vercel Functions: `/api/push-subscribe`, `/api/send-notification`, `/api/cron/daily-reminders`
- ✅ Cron diario 10:00 UTC para recordatorios post-partido
- ✅ Tabla `push_subscriptions` en Supabase
- ✅ Utilidades puras: `notificationUtils.ts` (payloads, calendar URL, validación)
- ✅ Frontend trigger: `handleScheduleMatch` → notifica al rival (o ambos si admin)
- ✅ Frontend trigger: `handleAddMatch` → notifica al rival (o ambos si admin)
- ✅ Hash routing `/#division/:id` — notificación abre la división del partido
- ✅ Botón "📅 Agregar al calendario" con 3 opciones (Google, Outlook, Apple .ics)
- ⬜ **Pendiente**: Notificaciones de partido sin rival, pagos, eventos, partido en vivo

### 3. Garmin Scoreboard — Fase 2 (sync con web)
- **Estado**: 📋 Pendiente (Fase 1 offline ✅)
- Vercel Function `/api/live-score` como proxy Garmin → Supabase
- HTTP POST al registrar cada punto → actualiza `live_score_state`
- HTTP GET polling cada 5s para sincronizar
- Selección de partido activo desde el reloj
- Auth via token (UUID del jugador)

### 4. Buscador de canchas v2 (CourtFinder)
- **Estado**: 🟡 Funcional, mejoras pendientes
- ✅ Componente `CourtFinder.tsx` con mapa Leaflet + venue cards
- ✅ Scraper `court_monitor/` con 21 venues (Better, ClubSpark, Flow)
- ✅ GitHub Action cada 2h genera `court_availability.json` (10 días ahead)
- ✅ Sistema de alertas: `court_watchlist` en Supabase + push + email
- ✅ Diff engine detecta slots liberados y notifica al usuario
- ✅ Al apretar notificación → abre link directo de booking
- ✅ Push con `urgency: high` — funciona con Power Saving en Samsung
- ✅ Notificación dual: push (inmediata) + email (siempre llega)
- ✅ Toast de confirmación al crear alerta con fecha y hora
- ⬜ **Pendiente**: Reestructurar vista "Buscar Cancha" — pestaña principal (monitor) + pestaña "Tips"
- ⬜ **Pendiente**: Sacar buscador iframe y apps recomendadas de la vista actual
- ⬜ **Pendiente**: Agregar más venues (Waterlow Park/Camden, otros)

### 5. Booking automático — ClubSpark
- **Estado**: 📋 Pendiente
- Cliente ClubSpark funcional (login SSO + generar link checkout)
- Flujo semi-automático: bot detecta slot → genera link → notifica → usuario paga en 15 seg
- Pestaña separada en panel de booking (Better = automático, ClubSpark = semi-automático)
- Agregar columna `platform` a `booking_accounts` (Better | ClubSpark)
- Guardar credenciales ClubSpark en GitHub Secrets + yml

---

## 🟡 Prioridad media (futuro cercano)

### 6. Dark mode
- **Estado**: 📋 Pendiente
- Tailwind `dark:` prefix — el Live Scoreboard ya usa fondo oscuro
- Resto de la app necesita colores invertidos
- Se activa según preferencia del sistema operativo

### 7. Calendario de partidos
- **Estado**: 📋 Pendiente
- Vista calendario semanal/mensual con partidos programados
- Cada jugador ve los suyos destacados
- Compartir a WhatsApp
- Cuidado: muchos espacios vacíos al principio de temporada

### 8. Fee Payment Tracking (cuotas)
- **Estado**: ✅ Implementado
- Lee estado de pagos desde Google Sheets (endpoint gviz público)
- Tres estados: pendiente (💰), pagado_sin_validar (✅), pagado (✅)
- Botón "Ya pagué" → Vercel Function actualiza Google Sheets
- Integrado en tabla de divisiones con íconos de estado

---

## 🟢 Prioridad baja (futuro)

### 9. React Router
- **Estado**: 📋 Pendiente
- URLs compartibles: `/#/tournament/abc`, `/#/player/xyz`
- Botón atrás del navegador funcional
- Deep linking
- Requiere refactor significativo de la navegación
- Nota: ya se usa hash routing parcial (`/#live/match/:id`, `/#division/:id`)

### 10. Estadísticas avanzadas
- **Estado**: 📋 Pendiente
- Rachas (🔥 3 victorias seguidas) — visible en home
- Jugador del mes (automático, basado en resultados)
- Evolución de ranking por temporada (cuando haya más historial)
- Head-to-head ya existe en perfiles — no duplicar

### 11. ELO Rating / predicciones
- **Estado**: 📋 Pendiente (prioridad muy baja)
- Ranking numérico global basado en historial
- Predicción pre-partido (% probabilidad)

### 12. Monitor de clases — mejoras
- **Estado**: 📋 Pendiente
- Agregar Islington Tennis Centre (clases Better) al scraper `tennis_dashboard/`
- Posible unificación con CourtFinder en una sola vista
- Más adelante

---

## 🔵 Ideas de producto / expansión

### 13. Multi-tenancy (Liga como servicio)
- **Estado**: 💡 Idea
- Tabla `organizations` en Supabase
- Cada liga tiene sus propios torneos, divisiones, jugadores
- Subdominio o ruta por liga
- Onboarding de admin: crear liga, invitar jugadores, configurar torneos
- Camino más claro a un producto vendible (SaaS)

### 14. Landing page pública
- **Estado**: 💡 Idea
- Página que explique qué es PPC Tennis, con screenshots, pricing
- Botón "Crear mi liga"

### 15. Dominio propio
- **Estado**: 💡 Idea
- `ppctennis.app` o similar en vez de `.vercel.app`

### 16. Stripe para pagos
- **Estado**: 💡 Idea
- Reemplazar Google Sheets por pagos reales con Stripe
- Jugadores pagan cuota directamente desde la web

### 17. Plataforma para profesores de tenis
- **Estado**: 💡 Idea
- Dashboard donde el profesor sube horarios, precios, niveles
- Alumnos buscan por ubicación/nivel/precio y reservan
- No requiere scraping — datos ingresados directamente

### 18. API pública del PPC
- **Estado**: 💡 Idea
- Vercel Function que exponga datos públicos como JSON
- Standings, resultados, próximos partidos

### 19. Garmin — Fase 3 (mejoras)
- **Estado**: 💡 Idea
- Companion app Android/iOS para sync Realtime
- Nombres de jugadores en pantalla del reloj
- Publicación en Connect IQ Store

### 20. Apple Watch / Wear OS
- **Estado**: 💡 Idea
- Misma lógica de puntuación, diferente lenguaje (Swift / Kotlin)
- Apple Watch tiene WebSocket nativo (mejor sync)

### 21. Alertas por Telegram / WhatsApp
- **Estado**: 💡 Idea (más adelante)
- Alternativa a push notifications para alertas de canchas
- Telegram más fácil (bot API), WhatsApp requiere Business API

---

## ❌ Descartado

| Idea | Motivo | Fecha |
|------|--------|-------|
| Sistema de challenges | Jugadores son conocidos, juegan amistosos fuera de la web. Solo partidos oficiales. | Mayo 2026 |

---

## Notas

- Este archivo se actualiza manualmente cuando surgen nuevas ideas o cambian prioridades
- Activar con `#ideas-backlog` en el chat de Kiro
- Las specs formales se crean en `.kiro/specs/` cuando una idea pasa a implementación
- El roadmap resumido también está en `ppc-final.md` (steering principal)
- Última actualización: 9 mayo 2026
