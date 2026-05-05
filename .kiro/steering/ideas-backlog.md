---
inclusion: manual
---

# Ideas y Backlog — PPC Tennis

Registro de ideas discutidas, priorizadas por el usuario. Activar con `#ideas-backlog` cuando se quiera revisar o planificar.

---

## 🔴 Prioridad alta (próximo a implementar)

### 1. Descomponer App.tsx
- **Estado**: 🚧 En progreso (spec creándose)
- Extraer componentes: DivisionTable, PlayerProfile, MatchResultForm, BookingPanel, BracketView, NavMenu, etc.
- Sin cambiar funcionalidad visible — solo reorganizar código
- Base necesaria para todo lo demás

### 2. Notificaciones push
- **Estado**: 📋 Pendiente
- Ya hay base: Supabase Realtime + service worker registrado
- Falta: push del navegador (Web Push API) + UI de preferencias
- Notificar: partido nuevo programado, resultado cargado, partido en vivo, fecha límite cercana
- El usuario intentó implementarlo antes pero no funcionó bien — revisar código existente

### 3. Garmin Scoreboard — Fase 2 (sync con web)
- **Estado**: 📋 Pendiente (Fase 1 offline ✅)
- Vercel Function `/api/live-score` como proxy Garmin → Supabase
- HTTP POST al registrar cada punto → actualiza `live_score_state`
- HTTP GET polling cada 5s para sincronizar
- Selección de partido activo desde el reloj
- Auth via token (UUID del jugador)

---

## 🟡 Prioridad media (futuro cercano)

### 4. Dark mode
- **Estado**: 📋 Pendiente
- Tailwind `dark:` prefix — el Live Scoreboard ya usa fondo oscuro
- Resto de la app necesita colores invertidos
- Se activa según preferencia del sistema operativo

### 5. Buscador de canchas mejorado (tipo Spin App)
- **Estado**: 💡 Idea en exploración
- Combinar "Buscar Cancha" + "Buscar Clases" en una sola vista
- Scraper de disponibilidad de canchas (Better ya resuelto, ClubSpark/Flow por investigar)
- Mapa con canchas cercanas por ubicación
- Alertas cuando se libera una hora (watchlist ya existe para clases)
- Segundo JSON: `court_availability.json` generado cada 1-2h
- Potencial para ser producto independiente

### 6. Calendario de partidos
- **Estado**: 📋 Pendiente
- Vista calendario semanal/mensual con partidos programados
- Cada jugador ve los suyos destacados
- Compartir a WhatsApp
- Cuidado: muchos espacios vacíos al principio de temporada

---

## 🟢 Prioridad baja (futuro)

### 7. React Router
- **Estado**: 📋 Pendiente
- URLs compartibles: `/#/tournament/abc`, `/#/player/xyz`
- Botón atrás del navegador funcional
- Deep linking
- Requiere refactor significativo de la navegación

### 8. Estadísticas avanzadas
- **Estado**: 📋 Pendiente
- Rachas (🔥 3 victorias seguidas) — visible en home
- Jugador del mes (automático, basado en resultados)
- Evolución de ranking por temporada (cuando haya más historial)
- Head-to-head ya existe en perfiles — no duplicar

### 9. ELO Rating / predicciones
- **Estado**: 📋 Pendiente (prioridad muy baja, fue rechazado antes)
- Ranking numérico global basado en historial
- Predicción pre-partido (% probabilidad)
- Podría revivir en el futuro si hay interés

---

## 🔵 Ideas de producto / expansión

### 10. Multi-tenancy (Liga como servicio)
- **Estado**: 💡 Idea
- Tabla `organizations` en Supabase
- Cada liga tiene sus propios torneos, divisiones, jugadores
- Subdominio o ruta por liga
- Onboarding de admin: crear liga, invitar jugadores, configurar torneos
- Camino más claro a un producto vendible (SaaS)

### 11. Landing page pública
- **Estado**: 💡 Idea
- Página que explique qué es PPC Tennis, con screenshots, pricing
- Botón "Crear mi liga"
- Ahora ppctennis.vercel.app va directo al login

### 12. Dominio propio
- **Estado**: 💡 Idea
- `ppctennis.app` o similar en vez de `.vercel.app`
- Más profesional para vender/compartir

### 13. Stripe para pagos
- **Estado**: 💡 Idea
- Reemplazar Google Sheets por pagos reales con Stripe
- Jugadores pagan cuota directamente desde la web
- Dashboard de admin para ver estado de pagos

### 14. Plataforma para profesores de tenis
- **Estado**: 💡 Idea
- Dashboard donde el profesor sube horarios, precios, niveles
- Alumnos buscan por ubicación/nivel/precio y reservan
- Notificaciones de nuevas reservas
- Historial de alumnos, pagos, asistencia
- No requiere scraping — datos ingresados directamente

### 15. API pública del PPC
- **Estado**: 💡 Idea
- Vercel Function que exponga datos públicos como JSON
- Standings, resultados, próximos partidos
- Otros pueden construir bots, widgets, integraciones

### 16. Garmin — Fase 3 (mejoras)
- **Estado**: 💡 Idea
- Companion app Android/iOS para sync Realtime
- Nombres de jugadores en pantalla del reloj
- Estadísticas post-partido
- Publicación en Connect IQ Store

### 17. Apple Watch / Wear OS
- **Estado**: 💡 Idea
- Misma lógica de puntuación, diferente lenguaje (Swift / Kotlin)
- Apple Watch tiene WebSocket nativo (mejor sync)
- Requiere Mac para desarrollo de Apple Watch

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
