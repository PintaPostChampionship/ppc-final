# Resumen Sesión 23 Agosto 2026

## Cambios principales realizados

### 1. Formularios Agendar/Resultado — Vista independiente
- Los formularios de "Agendar Partido" y "Agregar Resultado" ahora se muestran como una **vista independiente** dentro de la división (controlada por `showMatchForms` state)
- Cuando `showMatchForms = true`: se oculta el contenido de la división y se muestran los formularios con sub-tabs
- El header cambia dinámicamente: muestra "← Volver a {División}" y el título del formulario activo
- Navbar apunta correctamente a esta vista
- Botón "🎾 Agendar / Resultado" en la división activa `showMatchForms`

### 2. Copa Andrea Vivaldi — Torneo Golden Point Slam
- **Página de registro** (`GoatRegistration.tsx`) completamente reescrita con:
  - Foto principal + historia real de Andrea (ingeniero espacial, profesor de tenis)
  - Galería de fotos (foto-1 a foto-4 en `/public/Andrea-Vivaldi/`)
  - Bases del torneo completas (formato, reglas, cachipún, reglamento, fair play)
  - Checkbox "He leído..." antes de poder inscribirse
  - Fecha: Sábado 22 de Agosto
- **Banner en el home** visible para todos (inscritos ven "Ver inscritos →", no inscritos ven "Inscríbete →")
- **Torneo visible en home solo para admins** (`HIDDEN_TOURNAMENT_IDS` + `currentUser?.role === 'admin'`)
- **Bracket de 32 jugadores** en BracketView (7 columnas, compact cards)
- **Partidos R32 creados** con 22 jugadores reales + 10 Byes (historic_players)
- **Select Winner** — botones para elegir ganador directamente (sin sets) con `advanceWinner` que crea el siguiente partido
- **Alertas por ronda** — R32/R16 = canchas de cemento, QF/SF/F = canchas de pasto
- `getNextMatchPosition` ahora soporta R32 → R16

### 3. Live Scoreboard — Panel de Edición (Admin)
- **Panel colapsable "⚙️ Panel de Edición"** (solo admins) con:
  - Selector de **Color del Overlay** (6 temas: Broadcast, Forest, Oro, Plata, Bronce, WPPC) con mini-previews
  - Selector de **Indicador de Saque** (🎾 Pelota, Logo PPC, Logo Forest)
  - Selector de **Logo del Overlay** (PPC, Forest, PPC+Forest)
  - Botón de **Prioridad Streaming** (is_featured)
  - Añadir editor
  - Reiniciar / Cancelar
- **Campos nuevos en `live_score_state`**: `theme`, `serve_indicator`, `overlay_logo` (migración aplicada)
- **Cambio de tema en caliente** — se guarda en DB, overlay lo lee cada 2s
- **Permisos expandidos**: admin | jugadores del partido | editores pueden controlar puntos

### 4. Live Overlay (OBS/Twitch)
- **Nuevo formato** con header (🏆 Final + PPC Edición 5), headers de columna, barra de servicio lateral
- **Transparencia** reducida a 70% (antes 90%)
- **Tamaño reducido ~20%** (310-400px, fonts 13px)
- **Logo dinámico** a la izquierda (PPC | Forest | PPC+Forest) según selector
- **Indicador de saque dinámico** (🎾 | logo PPC | logo Forest)
- **Raqueta a la derecha** del nombre (no a la izquierda)
- API `overlay-state` devuelve `theme`, `serve_indicator`, `overlay_logo` desde DB

### 5. Finals Preview (`/#finals-preview`)
- Quitado "En Vivo" de abajo
- Web URL (`ppctennis.vercel.app`) movida al footer
- Nombres completos (no truncados)
- Raqueta a la derecha del nombre
- WPPC muestra "WPPC Edición 2"
- Forest/PPC muestra "PPC Edición 5"

### 6. Formato "Short Sets" (nuevo)
- Sets de 4 games, **CON ventaja** (deuce normal), tiebreak a 4-4 con reglas standard (diff 2)
- Disponible como opción al iniciar partido en vivo
- Tipo: `'short'` en `MatchFormat`

### 7. Notificaciones reactivadas
- Push notifications al iniciar partido en vivo: reactivadas (estaban deshabilitadas "for testing")
- `initMatch` ahora llama `api/live-score` con `action: 'notify-live'`
- API tiene nuevo handler `notify-live` que envía push a todos los subscribers

### 8. Bug fixes
- **DELETE policy** agregada a `live_score_state` (fix: botón "Cancelar" no borraba por RLS)
- **Cancelar live** ahora funciona correctamente (DELETE del registro + revert match a scheduled)
- **Count banner** — fetch del AV tournament count movido de `catch` a `finally` (antes solo corría si había error)
- **Tournament card** — filtra `status !== 'retired'` para no contar retirados

### 9. Partidos creados en DB
- **Repechaje Bronce**: Vincent Pollock vs Tomas Fuchs (17 ago)
- **Repechaje Plata**: Joao Bofill vs Francisco O'Ryan, Ignacio Canessa vs Sebastian Lewis (17 ago)
- **Final Bronce** ajustada: Nico Rojas vs Matías Clarke (era SF, ahora F)
- **SF Bronce borrada** (nadie podía jugar)
- **R32 Andrea Vivaldi**: 16 partidos creados (22 reales + 10 byes)

### 10. Streaming Guide
- Nueva página `StreamingGuide.tsx` accesible desde navbar (admins)
- Instrucciones para PRISM (celular) y OBS (computador)
- URL del overlay para copiar

---

## Pendientes para la próxima sesión

### 1. Andrea Vivaldi — Actualizar brackets
- Durante el campeonato se rellenaron byes con gente presente
- Hay que actualizar los `historic_players` (renombrar Byes) o cambiar los IDs
- Agregar resultados de los partidos jugados y avanzar ganadores

### 2. Formato Short Sets — Bugs de lógica
- A veces con múltiples deuces se "marea" (no alterna correctamente)
- Al terminar un set, no siempre asigna bien quién debe sacar
- En tiebreak 7-6 a veces lo da como terminado prematuramente
- Revisar `addPointStandard`, `winGame` (lógica de alternación de saque), y `addPointTiebreak` en `liveScoreUtils.ts`
- Puede afectar otros formatos — verificar standard y supertiebreak también

### 3. Finalización de partidos — Datos incompletos
- Algunos partidos finalizados desde el live no guardaron el resultado completo en `matches` + `match_sets`
- Verificar la función `finalizeMatch` en `useLiveScore.ts` y `handleFinalize` en `LiveScoreboard.tsx`
- Actualmente no hay partidos en `status = 'live'` (todo limpio)

---

## Archivos clave modificados

| Archivo | Cambio principal |
|---------|-----------------|
| `src/App.tsx` | showMatchForms, banner AV, visible para admins, streaming guide |
| `src/components/GoatRegistration.tsx` | Reescrito completo (tributo + bases + fotos) |
| `src/components/BracketView.tsx` | Bracket 32 jugadores, select winner, alertas, R32 support |
| `src/components/LiveScoreboard/LiveScoreboard.tsx` | Panel edición, permisos expandidos, formato short |
| `src/components/LiveScoreboard/LiveOverlay.tsx` | Nuevo formato, transparencia, logos dinámicos |
| `src/components/LiveScoreboard/liveScoreUtils.ts` | Formato 'short', campos theme/is_featured |
| `src/components/LiveScoreboard/useLiveScore.ts` | initMatch con theme, notify-live |
| `src/components/FinalsPreview.tsx` | Nombres completos, sin "En Vivo", web abajo |
| `src/components/StreamingGuide.tsx` | Nuevo componente |
| `src/lib/displayUtils.ts` | tournamentLogoSrc para Andrea Vivaldi |
| `api/live-score.ts` | notify-live action, notificaciones reactivadas |
| `api/overlay-state.ts` | Devuelve theme/serve_indicator/overlay_logo desde DB |

## Migraciones Supabase aplicadas
- `add_live_score_state_delete_policy` — DELETE policy para live_score_state
- `add_theme_to_live_score_state` — campo `theme` (default 'broadcast')
- `add_serve_indicator_and_logo_to_live_score` — campos `serve_indicator`, `overlay_logo`
