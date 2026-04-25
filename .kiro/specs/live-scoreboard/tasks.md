# Plan de Implementación: Live Scoreboard — PPC Tennis

## Visión general

Implementar el Live Scoreboard en TypeScript + React + Tailwind, integrado en la app existente (`src/App.tsx`) mediante hash routing. El estado del marcador se persiste en Supabase (`live_score_state`) y se propaga en tiempo real con Supabase Realtime. Al finalizar, el resultado se guarda automáticamente en `matches` y `match_sets`.

**Stack de testing:** Vitest + fast-check (property-based) + @testing-library/react (componentes).

---

## Tareas

- [ ] 1. Configurar el entorno de testing
  - Instalar dependencias de desarrollo: `vitest`, `@vitest/ui`, `fast-check`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
  - Actualizar `vite.config.ts` para incluir la configuración de Vitest con `globals: true` y `environment: 'node'` para tests de lógica pura, y `environment: 'jsdom'` para tests de componentes
  - Añadir script `"test": "vitest --run"` en `package.json`
  - Crear el directorio `src/components/LiveScoreboard/__tests__/`
  - _Requirements: estrategia de testing del diseño_

- [x] 2. Crear la tabla `live_score_state` en Supabase
  - Ejecutar el SQL del diseño para crear la tabla `live_score_state` con todos sus campos: `id`, `match_id` (UNIQUE FK → matches), `p1_sets`, `p2_sets`, `p1_games`, `p2_games`, `p1_points`, `p2_points`, `server`, `in_tiebreak`, `in_super_tiebreak`, `completed_sets` (jsonb), `previous_state` (jsonb), `format`, `best_of`, `editor_ids` (uuid[]), `status`, `created_at`, `updated_at`
  - Crear el índice `idx_live_score_state_match_id` sobre `match_id`
  - Crear el trigger `update_live_score_state_updated_at` que actualiza `updated_at` automáticamente en cada UPDATE
  - Habilitar RLS en la tabla y crear las tres políticas del diseño: SELECT para cualquier usuario autenticado, INSERT solo para jugadores del partido o admins, UPDATE para jugadores del partido, admins, o usuarios en `editor_ids`
  - Verificar que el campo `status` de la tabla `matches` ya acepta el valor `'live'` (es tipo `text`, no requiere ALTER TABLE)
  - _Requirements: 1.2, 1.3, 4.6, 15.2, 15.3_

- [x] 3. Implementar tipos y lógica pura de puntuación (`liveScoreUtils.ts`)
  - Crear el archivo `src/components/LiveScoreboard/liveScoreUtils.ts`
  - Definir los tipos TypeScript: `MatchFormat` (`'standard' | 'nextgen' | 'supertiebreak'`), `CompletedSet`, `LiveScoreState` (con todos los campos del diseño incluyendo `previous_state`)
  - Implementar `initialState(matchId, format, firstServer)`: devuelve el estado inicial con todos los contadores a 0, `completed_sets: []`, `status: 'live'`, `previous_state: null`, `in_tiebreak: false`, `in_super_tiebreak: false`, y `server` igual al primer sacador
  - Implementar `isEditor(userId, matchHomeId, matchAwayId, userRole, editorIds)`: devuelve `true` si el usuario es jugador del partido, admin, o está en `editorIds`
  - Implementar `formatPointScore(p1Points, p2Points, inTiebreak, format)`: convierte los valores numéricos internos al display correcto (0/15/30/40/Deuce/Ad para Standard, numérico para tiebreak)
  - Implementar `getServeAfterGame(currentServer)`: alterna el saque entre juegos normales
  - Implementar `getServeAfterTiebreakPoint(currentServer, tiebreakPoints)`: alterna el saque cada 2 puntos en tiebreak/super tiebreak
  - _Requirements: 1.3, 1.6, 3.2, 5.1, 8.2, 8.4, 14.3_

- [x] 4. Implementar `addPoint` — lógica central de puntuación
  - En `liveScoreUtils.ts`, implementar `addPoint(state, player)` que:
    1. Guarda `previous_state` como copia del estado actual (sin anidar `previous_state`)
    2. Delega a la lógica de puntuación según `format` e `in_tiebreak`/`in_super_tiebreak`
    3. Si el jugador gana el juego → actualiza `p1_games`/`p2_games`, verifica victoria del set
    4. Si el jugador gana el set → añade a `completed_sets`, actualiza `p1_sets`/`p2_sets`, prepara el siguiente set (o inicia Super Tiebreak si aplica)
    5. Si el jugador alcanza 2 sets → marca `status: 'finished'`
    6. Actualiza `server` según las reglas de saque
  - Implementar la lógica Standard: secuencia 0→1→2→3→Game, Deuce en 3-3, Ad en 4-3, tiebreak en 6-6 (gana con 7+ y diferencia ≥ 2, set queda 7-6)
  - Implementar la lógica NextGen: sets de 4 juegos, sin Deuce (punto de oro en 3-3), tiebreak en 4-4 (gana con 7+ y diferencia ≥ 2, punto de oro en 6-6)
  - Implementar la lógica SuperTiebreak: Standard para los dos primeros sets; si sets quedan 1-1, el tercer "set" es un Super Tiebreak (gana con 10+ y diferencia ≥ 2)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1–5.8, 6.1–6.5, 7.1–7.4, 8.2–8.4_

- [ ] 5. Crear generadores arbitrarios para property-based tests
  - Crear `src/components/LiveScoreboard/__tests__/arbitraries.ts`
  - Implementar `arbitraryMatchFormat()`: genera `'standard' | 'nextgen' | 'supertiebreak'` con `fc.constantFrom`
  - Implementar `arbitraryLiveScoreState()`: genera estados válidos con puntos en rango correcto según formato, sets consistentes con `completed_sets`, `in_tiebreak` y `in_super_tiebreak` mutuamente excluyentes, `status: 'live'`, `previous_state: null`
  - Implementar `arbitraryTiebreakState()`: genera estados con `in_tiebreak: true` y puntos numéricos válidos
  - Implementar `arbitraryDeuceState()`: genera estados con `p1_points: 3, p2_points: 3` en Standard_Format
  - Implementar `arbitraryIsEditorArgs()`: genera combinaciones de `userId`, `homeId`, `awayId`, `role`, `editorIds`
  - _Requirements: estrategia de testing del diseño_

- [ ] 6. Escribir property-based tests para `liveScoreUtils.ts`
  - Crear `src/components/LiveScoreboard/__tests__/liveScoreUtils.test.ts`
  - [ ]* 6.1 Property 10: `initialState` siempre produce un estado válido y consistente
    - Para cualquier combinación de formato y primer sacador, verificar que todos los contadores son 0, `completed_sets` es `[]`, `status: 'live'`, `previous_state: null`, `in_tiebreak: false`, `in_super_tiebreak: false`, y `server` coincide con el primer sacador
    - **Validates: Requirements 1.3, 14.3, 14.4**
  - [ ]* 6.2 Property 1: Undo es la inversa exacta de `addPoint` (1 nivel)
    - Para cualquier estado válido y jugador (1 o 2), aplicar `addPoint` y verificar que `newState.previous_state` es equivalente al estado original en todos los campos de marcador, y que `newState.previous_state.previous_state` es `null`
    - **Validates: Requirements 4.5, 10.1, 10.3**
  - [ ]* 6.3 Property 2: `addPoint` nunca decrece el marcador acumulado
    - Para cualquier estado con `status: 'live'`, verificar que `(p1_sets + p2_sets + p1_games + p2_games + p1_points + p2_points)` en el estado resultante es ≥ al original
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [ ]* 6.4 Property 7: El partido finaliza exactamente al alcanzar 2 sets ganados
    - Para cualquier estado donde un jugador alcanza 2 sets como resultado de `addPoint`, verificar que `status === 'finished'`. Verificar también que sobre un estado `finished`, `addPoint` no produce cambios en el marcador
    - **Validates: Requirements 4.4, 9.1**
  - [ ]* 6.5 Property 5: La secuencia de puntos en Standard sigue 0→15→30→40→Deuce/Game
    - Para cualquier estado Standard donde ningún jugador tiene ventaja (`p1_points < 3` o `p2_points < 3`), verificar que `addPoint` incrementa `p_points` del jugador en exactamente 1, o gana el juego si ya tenía 3 y el rival menos de 3
    - **Validates: Requirements 5.1, 5.2**
  - [ ]* 6.6 Property 6: Deuce/Ad es un ciclo reversible
    - Para cualquier estado en Deuce (p1_points=3, p2_points=3) en Standard, verificar que si A gana un punto (Ad) y luego B gana un punto, el resultado es de nuevo Deuce (3-3)
    - **Validates: Requirements 5.3, 5.4, 5.5**
  - [ ]* 6.7 Property 12: NextGen nunca entra en estado Deuce
    - Para cualquier estado NextGen, verificar que `addPoint` nunca produce un estado donde `p1_points === 3 && p2_points === 3` sin que el juego haya terminado
    - **Validates: Requirements 6.2, 6.3**
  - [ ]* 6.8 Property 8: El tiebreak solo termina con 7+ puntos y diferencia ≥ 2 (Standard) o punto de oro en 6-6 (NextGen)
    - Para cualquier estado de tiebreak Standard, verificar que `in_tiebreak` solo pasa a `false` cuando el ganador tiene ≥ 7 puntos y la diferencia es ≥ 2. Para NextGen, verificar la misma regla excepto en 6-6 donde el siguiente punto gana
    - **Validates: Requirements 5.7, 6.4, 6.5**
  - [ ]* 6.9 Property 9: El Super Tiebreak solo termina con 10+ puntos y diferencia ≥ 2
    - Para cualquier estado con `in_super_tiebreak: true`, verificar que `in_super_tiebreak` solo pasa a `false` cuando el ganador tiene ≥ 10 puntos y la diferencia es ≥ 2
    - **Validates: Requirements 7.2**
  - [ ]* 6.10 Property 15: El tiebreak se activa en el momento correcto según el formato
    - Para estados donde ambos jugadores tienen el mismo número de games igual al límite del formato (6 en Standard/SuperTiebreak, 4 en NextGen), verificar que el punto que completa ese juego produce `in_tiebreak: true`. Para SuperTiebreak con sets 1-1, verificar que el tercer set produce `in_super_tiebreak: true`
    - **Validates: Requirements 5.6, 6.4, 7.1**
  - [ ]* 6.11 Property 3: El saque alterna correctamente entre juegos consecutivos
    - Para cualquier estado fuera de tiebreak, cuando `addPoint` completa un juego (games totales aumentan), verificar que `server` en el nuevo estado es el contrario al `server` original
    - **Validates: Requirements 8.2**
  - [ ]* 6.12 Property 4: El saque en tiebreak alterna cada 2 puntos
    - Para cualquier estado de tiebreak, verificar que el sacador en el punto N es determinado por `floor(t/2) % 2`: par = primer sacador del tiebreak, impar = contrario
    - **Validates: Requirements 8.3, 8.4**
  - [ ]* 6.13 Property 13: `isEditor` es correcto para todos los casos positivos y negativos
    - Para cualquier combinación de argumentos, verificar que `isEditor` devuelve `true` si y solo si `userId === homeId`, o `userId === awayId`, o `userRole === 'admin'`, o `editorIds.includes(userId)`
    - **Validates: Requirements 1.5, 1.6, 4.7, 11.3**
  - [ ]* 6.14 Property 11: `formatPointScore` es total y determinista
    - Para cualquier combinación válida de `(p1_points, p2_points, inTiebreak, format)`, verificar que `formatPointScore` devuelve siempre una cadena no vacía y nunca lanza excepción. La misma entrada siempre produce la misma salida
    - **Validates: Requirements 3.2, 5.1, 6.2**

- [ ] 7. Checkpoint — Verificar lógica pura
  - Ejecutar `npm test` y confirmar que todos los property-based tests pasan. Preguntar al usuario si hay dudas antes de continuar con el hook y los componentes.

- [x] 8. Implementar el hook `useLiveScore.ts`
  - Crear `src/components/LiveScoreboard/useLiveScore.ts`
  - Implementar la carga inicial: al montar, hacer `SELECT * FROM live_score_state WHERE match_id = matchId` y establecer el estado local
  - Implementar la suscripción Realtime: suscribirse al canal `postgres_changes` en `live_score_state` filtrado por `match_id = matchId`; al recibir un evento `UPDATE`, actualizar el estado local con el nuevo registro
  - Implementar `addPoint(player)`: calcular el nuevo estado con `liveScoreUtils.addPoint`, hacer `UPDATE live_score_state SET ... WHERE match_id = matchId`, mostrar toast de error si falla (sin actualizar el estado local)
  - Implementar `undo()`: si `state.previous_state` no es null, hacer `UPDATE live_score_state SET ... WHERE match_id = matchId` con el snapshot restaurado (con `previous_state: null`)
  - Implementar `addEditor(userId)`: verificar que el usuario existe en `profiles`, luego hacer `UPDATE live_score_state SET editor_ids = array_append(editor_ids, userId) WHERE match_id = matchId`
  - Implementar `initMatch(format, firstServer)`: crear el registro inicial con `INSERT INTO live_score_state` usando `liveScoreUtils.initialState`, y actualizar `matches SET status = 'live'`
  - Implementar `finalizeMatch()`: actualizar `matches SET status = 'played', player1_sets_won, player2_sets_won, player1_games_won, player2_games_won`; insertar filas en `match_sets` para cada set en `completed_sets`; mostrar toast de error si falla
  - Implementar gestión de conexión Realtime: exponer `connectionStatus` (`'connected' | 'connecting' | 'disconnected'`), reconexión automática con backoff lineal (hasta 5 intentos, 2s de delay × intento), recargar estado desde DB al reconectar
  - Desuscribir el canal al desmontar el hook
  - _Requirements: 1.2, 1.3, 4.6, 9.1–9.3, 10.1, 10.2, 11.2, 11.4, 15.1, 15.2, 15.4_

- [x] 9. Implementar `LiveScoreDisplay.tsx` — componente presentacional del marcador
  - Crear `src/components/LiveScoreboard/LiveScoreDisplay.tsx`
  - Definir la interfaz `LiveScoreDisplayProps` con `state`, `player1Name`, `player2Name`, `player1Avatar?`, `player2Avatar?`, `compact?`
  - Renderizar los nombres de ambos jugadores con el indicador de saque (🎾) junto al jugador con `server === 1` o `server === 2`
  - Renderizar el historial de sets completados (`completed_sets`) como columnas de Set_Score
  - Renderizar los games del set actual (`p1_games` / `p2_games`)
  - Renderizar el Point_Score del juego en curso usando `formatPointScore` (0/15/30/40/Deuce/Ad o numérico en tiebreak)
  - Mostrar el indicador de estado de conexión Realtime cuando `connectionStatus !== 'connected'` (texto "Reconectando..." o "Conexión perdida")
  - Soportar modo `compact` para uso en el Banner (nombres + marcador simplificado sin Point_Score)
  - _Requirements: 3.2, 3.3, 3.5, 3.6, 8.1_

- [ ] 10. Escribir tests de ejemplo para `LiveScoreDisplay.tsx`
  - [ ]* 10.1 Renderiza correctamente en modo normal con estado de ejemplo
    - Verificar que aparecen los nombres de ambos jugadores, el marcador de games, el Point_Score, y el historial de sets
    - _Requirements: 3.2, 3.3, 3.5_
  - [ ]* 10.2 El indicador de saque apunta al jugador correcto
    - Renderizar con `server: 1` y verificar que el indicador 🎾 está junto al jugador 1; luego con `server: 2` y verificar que está junto al jugador 2
    - _Requirements: 3.3, 8.1_
  - [ ]* 10.3 Muestra el indicador de reconexión cuando `connectionStatus !== 'connected'`
    - _Requirements: 3.6_
  - [ ]* 10.4 Property 14: El display siempre contiene toda la información requerida
    - Para cualquier estado válido de `LiveScoreState` y nombres de jugadores no vacíos, verificar que el componente renderizado contiene: nombre de ambos jugadores, marcador de games, Point_Score en formato legible, historial de sets, e indicador de saque junto al jugador correcto
    - **Validates: Requirements 3.2, 3.3, 3.5, 8.1**

- [x] 11. Implementar `LiveScoreboard.tsx` — componente principal
  - Crear `src/components/LiveScoreboard/LiveScoreboard.tsx`
  - Definir la interfaz `LiveScoreboardProps` con `matchId`, `currentUser`, `currentProfile`, `onBack`
  - Al montar, cargar los datos del partido desde `matches` (incluyendo `home_player_id`, `away_player_id`) y los perfiles de ambos jugadores desde `profiles`
  - Manejar los casos de error de acceso: partido no encontrado (mostrar mensaje + botón volver), partido ya finalizado (mostrar marcador final en modo solo lectura)
  - Usar `useLiveScore(matchId, currentUser.id)` para el estado en tiempo real
  - Determinar si el usuario es Editor con `isEditor(currentUser.id, match.home_player_id, match.away_player_id, currentProfile.role, state.editor_ids)`
  - Si el partido no tiene `live_score_state` aún (estado null), mostrar el flujo de inicio: selector de formato (Standard / NextGen / Super Tiebreak) y selector del primer sacador (Jugador 1 / Jugador 2); al confirmar, llamar a `initMatch(format, firstServer)`
  - Renderizar `LiveScoreDisplay` con el estado actual y los nombres de los jugadores
  - Si el usuario es Editor, renderizar los controles de registro de puntos: dos botones grandes "Punto [Jugador 1]" y "Punto [Jugador 2]", botón Undo (deshabilitado si `state.previous_state === null`), y control para añadir editores adicionales (búsqueda de usuario en `profiles` + botón añadir)
  - Cuando `state.status === 'finished'`, mostrar el marcador final y el mensaje recordatorio: "Recuerda que puedes editar el partido para agregar pintas o anécdota."
  - Renderizar el botón de compartir (accesible para Editors y Viewers): al pulsarlo, mostrar opciones "Copiar enlace" y "Compartir por WhatsApp"
  - _Requirements: 1.1, 1.4, 1.5, 2.2, 2.3, 2.4, 4.7, 9.4, 9.5, 10.4, 11.1, 13.1, 14.1, 14.2_

- [x] 12. Implementar la funcionalidad de compartir
  - En `LiveScoreboard.tsx`, implementar la acción "Copiar enlace": usar `navigator.clipboard.writeText(window.location.href)` para copiar la Hash_Route completa; mostrar confirmación visual ("¡Enlace copiado!") durante 2 segundos; si la API de portapapeles no está disponible, mostrar la URL en un campo de texto para copia manual
  - Implementar la acción "Compartir por WhatsApp": construir la URL `https://wa.me/?text=` con un mensaje predefinido que incluya los nombres de los jugadores y la Hash_Route del partido; abrir en nueva pestaña con `window.open`
  - _Requirements: 13.2, 13.3, 13.4, 13.5_

- [ ] 13. Escribir tests de ejemplo para `LiveScoreboard.tsx`
  - [ ]* 13.1 Renderiza en modo Viewer sin controles de Editor
    - Mockear `useLiveScore` con un estado de partido en vivo; verificar que los botones de punto y Undo no están presentes para un usuario que no es Editor
    - _Requirements: 4.7, 10.5_
  - [ ]* 13.2 Renderiza controles de Editor cuando el usuario es Editor
    - Verificar que los botones "Punto [Jugador 1]", "Punto [Jugador 2]", y Undo están presentes
    - _Requirements: 4.7_
  - [ ]* 13.3 El botón Undo está deshabilitado cuando `previous_state === null`
    - _Requirements: 10.4_
  - [ ]* 13.4 El mensaje de finalización aparece cuando `status === 'finished'`
    - Verificar que aparece el texto del recordatorio de pintas/anécdota
    - _Requirements: 9.4, 9.5_
  - [ ]* 13.5 El botón de compartir copia la URL correcta al portapapeles
    - Mockear `navigator.clipboard.writeText` y verificar que se llama con la Hash_Route correcta
    - _Requirements: 13.3_

- [ ] 14. Checkpoint — Verificar componentes
  - Ejecutar `npm test` y confirmar que todos los tests de componentes pasan. Preguntar al usuario si hay dudas antes de continuar con la integración en App.tsx.

- [x] 15. Implementar `LiveMatchBanner.tsx` — banner global de partidos en vivo
  - Crear `src/components/LiveScoreboard/LiveMatchBanner.tsx`
  - Definir la interfaz `LiveMatchBannerProps` con `currentProfile`
  - Solo renderizar si `currentProfile?.role === 'admin'` (Fase 1)
  - Al montar, cargar los partidos con `status = 'live'` desde `matches` junto con los perfiles de los jugadores
  - Suscribirse a cambios Realtime en la tabla `matches` filtrado por `status = 'live'` para mantener la lista actualizada sin recargar
  - Si hay exactamente 1 partido en vivo: mostrar los nombres de los jugadores y un enlace a `/#live/match/:id`
  - Si hay más de 1 partido en vivo: mostrar el número de partidos activos y un enlace a cada uno
  - Si no hay partidos en vivo: no renderizar nada (retornar `null`)
  - Desuscribir el canal Realtime al desmontar
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 16.4_

- [ ] 16. Escribir tests de ejemplo para `LiveMatchBanner.tsx`
  - [ ]* 16.1 No renderiza nada cuando no hay partidos en vivo
    - _Requirements: 12.3_
  - [ ]* 16.2 No renderiza nada para usuarios no admin (Fase 1)
    - _Requirements: 16.4_
  - [ ]* 16.3 Muestra el partido en vivo con enlace correcto cuando hay exactamente 1
    - _Requirements: 12.1, 12.2_
  - [ ]* 16.4 Muestra el número de partidos cuando hay más de 1
    - _Requirements: 12.5_

- [x] 17. Integrar el Live Scoreboard en `App.tsx`
  - Añadir el estado `liveMatchId: string | null` inicializado a `null`
  - En el `useEffect` de montaje (o en uno nuevo), leer `window.location.hash` y si coincide con el patrón `/#live/match/:id` (regex: `/^#live\/match\/([a-f0-9-]+)$/`), establecer `liveMatchId` con el id extraído
  - Añadir un listener `window.addEventListener('hashchange', handler)` que actualice `liveMatchId` cuando el hash cambie; limpiar el listener al desmontar
  - Añadir render condicional al inicio del árbol de render: si `liveMatchId !== null` y el usuario está autenticado, renderizar `<LiveScoreboard matchId={liveMatchId} currentUser={currentUser} currentProfile={currentProfile} onBack={() => { window.location.hash = ''; setLiveMatchId(null); }} />`
  - Si `liveMatchId !== null` y el usuario NO está autenticado, guardar el hash en `sessionStorage` (clave `'pending_hash'`) y redirigir al login; tras el login exitoso, leer `sessionStorage` y navegar al hash guardado
  - Añadir `<LiveMatchBanner currentProfile={currentProfile} />` en la parte superior del layout principal (visible en todas las vistas para admins)
  - Importar `LiveScoreboard` y `LiveMatchBanner` desde sus rutas en `src/components/LiveScoreboard/`
  - No añadir ningún enlace ni botón al Live Scoreboard en la navegación pública (Fase 1)
  - _Requirements: 1.4, 2.1, 2.2, 2.5, 12.1, 16.1, 16.2, 16.3_

- [x] 18. Implementar el flujo de inicio del partido desde la vista de partido existente
  - En `App.tsx`, localizar la sección donde se muestran los detalles de un partido (`Match`) con `status = 'pending'` o `status = 'scheduled'`
  - Añadir un botón "🎾 Iniciar marcador en vivo" visible únicamente si `isEditor(currentUser.id, match.home_player_id, match.away_player_id, currentProfile.role, [])` devuelve `true`
  - Al pulsar el botón, navegar a `/#live/match/${match.id}` usando `window.location.hash = \`#live/match/${match.id}\``; esto disparará el listener de `hashchange` y renderizará `LiveScoreboard`, que detectará que no hay `live_score_state` y mostrará el flujo de selección de formato
  - _Requirements: 1.1, 1.4, 1.5, 16.1_

- [x] 19. Checkpoint final — Verificar integración completa
  - Ejecutar `npm test` y confirmar que todos los tests pasan (property-based + componentes)
  - Verificar manualmente (o con tests de integración si el entorno lo permite) el flujo completo: iniciar partido → registrar puntos → undo → finalizar → verificar guardado en `matches` y `match_sets`
  - Verificar que el Banner aparece para admins cuando hay un partido en vivo y desaparece al finalizar
  - Verificar que la navegación pública no expone ningún enlace al Live Scoreboard
  - Preguntar al usuario si hay dudas o ajustes antes de dar la feature por completada.

---

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos que implementa para trazabilidad
- Los property-based tests usan fast-check con mínimo 100 iteraciones por propiedad
- Los tests de componentes usan @testing-library/react con jsdom
- El hash routing no introduce React Router ni ninguna dependencia nueva de navegación
- El Banner solo es visible para `role = 'admin'` durante la Fase 1 (Requirement 16)
- La lógica de puntuación en `liveScoreUtils.ts` es completamente pura (sin efectos secundarios), lo que la hace ideal para property-based testing
