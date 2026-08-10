---
inclusion: manual
---

# Garmin App + Web Marcador — Estado (julio 2026)

## Estado actual — App Garmin
- **Store**: PPC Tennis Scorer — última versión subida con todos los fixes
- **Source**: `c:\Users\jifon\projects\marcador-garmin\`
- **Store URL**: https://apps.garmin.com/apps/54b355b9-097a-4192-a115-48107e4269c8
- **Devices**: FR 265/265s, FR 965, Venu 2/2s/3/3s, Venu 4 (41mm/45mm), Vivoactive 5, Fenix 7/7s/7x
- **minApiLevel**: 4.2.0

### Features implementados:
- Layout: Rival arriba (rojo), Me abajo (verde)
- HR arc curvo con zonas + indicador
- Serve indicator verde
- GPS activo durante partido
- FIT fields: Winner, Set Scores, Sets Won, Total Points, Points Won, Serve %, Return %
- `fit_contributions.xml` para que aparezcan en Garmin Connect Stats tab
- Orden correcto: `session.stop()` → `writeMatchStats()` → `session.save()`
- Serve/Return % con scoring simulation real (deuce/advantage/tiebreak tracking)
- Pause Match: guarda pointLog + matchId + envía syncPause al server + retry si sin BT
- Resume Match: restaura pointLog + reconecta Go Live con server
- "New Match" NO borra el partido pausado (se mantiene para retomar)
- pendingPauseSync: se reintenta al abrir la app si falló por falta de BT
- Change Format funciona correctamente mid-match
- FONT_MEDIUM para "AD" en vez de FONT_NUMBER_HOT (fix Fenix 7 pantalla negra)
- Delay 2s antes del summary screen (da tiempo al sync final)
- "Rival" en vez de "P2" como nombre por defecto
- Undo múltiple (stack 20)
- Venu 4 soporte
- Sync resiliente (no se desconecta al primer error)

### Limitaciones conocidas:
- ObjectStore ~8KB — pointLog de partidos largos puede llenar el storage
- Sin BT: HTTP requests fallan inmediato (no hay cola). PendingPauseSync mitiga esto.
- Si la app crashea sin "Pause Match" o "Save & Exit" → pointLog se pierde del server
- Instinct 2/3 excluidos del manifest (causaban error de upload en la Store)

---

## Estado actual — Web Marcador (ppc-final)

### Source: `c:\Users\jifon\ppc-final\`
### URL: https://ppctennis.vercel.app

### Features implementados:
- **Tab "En Vivo"**: LiveMatchBanner (visible para todos, no solo admins) + Twitch colapsable
- **Tab "Jugar"**: FriendlyMatchCreator
- **Tab "Historial"**: MatchAnalytics con lista vertical, detalle full-page, auto-generate analysis
- **Tab "Garmin"**: GarminPairSection
- **Spectator view**: usuarios no-jugadores solo ven En Vivo + Twitch (sin tabs Jugar/Historial/Garmin)
- **Análisis IA**: Gemini 2.5 Flash Lite, auto-genera al abrir partido, botón ↻ para regenerar
- **Datos enriquecidos al análisis**: stats por set, rachas, HR por mitad, serve/return %
- **Scoring simulator** (`src/lib/scoringSimulator.ts`): replica exacta de PPCScoreboard.mc para Point-by-Point display
- **HR Chart con franjas**: bandas de color azul/verde/amarillo/rojo para zonas
- **Push notification al Go Live**: todos los suscriptores reciben aviso
- **Pause/Close desde web**: botones ⏸ y ✕ en LiveMatchBanner
- **Eliminar partido**: botón 🗑 en la lista de Historial
- **Editar rival**: botón ✏️ para amistosos (columna `rival_name` en DB)
- **Persistencia de vista**: expandedId en sessionStorage

### API (`api/live-score.ts`):
- Actions: init, sync, point, undo, save_log, analysis, pause, close
- Auth: JWT o X-Player-Id (Garmin fallback)
- Analysis action usa Gemini (GEMINI_API_KEY en Vercel env vars)
- Push notifications via web-push al init (match goes live)
- Status "paused" aceptado en sync

### DB (Supabase):
- `match_point_logs`: id, profile_id, match_id, format, result, point_log, duration_secs, avg_hr, max_hr, calories, source, created_at, analysis_text, rival_name
- `live_score_state`: status puede ser 'live', 'paused', 'finished'
- `matches`: status puede ser 'scheduled', 'pending', 'live', 'paused', 'played', 'cancelled'
- RLS policy UPDATE en match_point_logs para que usuarios puedan guardar analysis_text

---

## Contexto técnico
- Garmin source: `c:\Users\jifon\projects\marcador-garmin\`
- Web source: `c:\Users\jifon\ppc-final\`
- Supabase project: `tzmbznenarrpjayntyjt`
- Gemini API Key: en Vercel env vars como `GEMINI_API_KEY`
- Tabla analytics: `match_point_logs`
- Tabla pairing: `garmin_pairing_codes`
- Compilar Garmin: `monkeyc.bat -e -f monkey.jungle -o bin/PPCTennis.iq -y developer_key.der -r`

---

## Partidos registrados (referencia)
| Fecha | Rival | ID point_log | Resultado | Notas |
|-------|-------|-------------|-----------|-------|
| 23 jun | Carlos | 00ac46b0 | 6-3 (1 set) | Amistoso, format standard |
| 30 jun | Mario | f3d28950 | 6-2, 6-7, 6-10 STB | STB no tiene puntos en log (bug de sync) |
| 2 jul | Joao | ee3a7dc2 | 4-6, 7-5, 10-2 STB | Completo, 176 pts |
| 7 jul | Carlos | a9b777aa | 2-6, 4-6 | Oficial, con analysis |
| 16 jul | Mikey | 34801151 | 0-6, 6-3, 1-10 STB | Format corregido a STB, match_id vinculado |
| 21 jul | ? | live_score_state | 7-6, 4-6 (pausado) | No hay point_log, match interrumpido |
