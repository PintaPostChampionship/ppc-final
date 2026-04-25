# Requirements Document

## Introduction

El Live Scoreboard es una funcionalidad de PPC Tennis que permite registrar y visualizar el marcador de un partido de tenis en tiempo real. Un Editor inicia el marcador desde un partido ya agendado, y cualquier usuario registrado puede seguirlo en vivo desde una URL compartible. El sistema soporta tres formatos de partido: Singles Estándar (Mejor de 3, sets de 6 juegos con tiebreak en 6-6), NextGen (Mejor de 3, sets de 4 juegos sin ventaja) y Super Tiebreak (Mejor de 3, tercer set como Super Tiebreak de 10 puntos). Al finalizar, el resultado se guarda automáticamente en la base de datos y el partido pasa a estado `played`. La feature es accesible únicamente vía URL directa o para admins/testers durante la Fase 1 — no se expone en la navegación pública hasta validar su funcionamiento.

---

## Glossary

- **System**: El sistema Live Scoreboard de PPC Tennis (ppctennis.vercel.app).
- **Auth_Service**: El servicio de autenticación de Supabase que gestiona sesiones de usuario.
- **Realtime_Service**: El servicio de Supabase Realtime que propaga cambios de la tabla `live_score_state` a los clientes conectados.
- **DB**: La base de datos PostgreSQL de Supabase del proyecto PPC.
- **Editor**: Usuario con permiso para registrar puntos en un partido — los dos jugadores del partido (`home_player_id`, `away_player_id`), usuarios con `role = 'admin'` en `profiles`, o usuarios añadidos explícitamente como editores adicionales del partido.
- **Viewer**: Usuario registrado autenticado que observa el partido en tiempo real sin permiso de edición.
- **Match**: Registro en la tabla `matches` de Supabase con los datos del partido.
- **Live_Match**: Partido con `status = 'live'` en la tabla `matches`.
- **Live_Score_State**: Registro en la tabla `live_score_state` que almacena el estado completo del marcador en vivo de un partido.
- **Match_State**: Estructura de datos que representa el estado completo del marcador en un momento dado: formato, set actual, juegos del set en curso, Point_Score, sets ganados, historial de sets, jugador con el saque, y Undo_Snapshot.
- **Undo_Snapshot**: Copia del Match_State anterior al último punto registrado, usada para implementar el Undo de un nivel.
- **Point_Score**: Representación del marcador de puntos dentro de un juego: `0`, `15`, `30`, `40`, `Deuce`, `Ad` (ventaja).
- **Set_Score**: Par de números que representa los juegos ganados por cada jugador en un set (ej: 6-4).
- **Tiebreak**: Juego especial que se juega cuando el Set_Score llega a 6-6 (Standard_Format) o 4-4 (NextGen_Format). Se gana al llegar a 7 puntos con diferencia de 2 o más.
- **Super_Tiebreak**: Tercer set especial de 10 puntos (con diferencia de 2) que reemplaza al tercer set completo.
- **Standard_Format**: Formato de sets de 6 juegos con ventaja (Deuce/Ad) y Tiebreak en 6-6.
- **NextGen_Format**: Formato de sets de 4 juegos sin ventaja (punto de oro en Deuce) y Tiebreak en 4-4.
- **SuperTiebreak_Format**: Formato Mejor de 3 donde el tercer set es un Super_Tiebreak de 10 puntos.
- **Serve_Indicator**: Indicador visual de qué jugador tiene el saque en el momento actual.
- **Hash_Route**: URL con formato `/#live/match/:id` que identifica un partido en vivo y permite acceso directo compartible.
- **Banner**: Componente visual persistente en la app que notifica la existencia de partidos en vivo.
- **Additional_Editor**: Usuario registrado añadido explícitamente por un Editor como editor adicional de un partido específico.

---

## Requirements

### Requirement 1: Inicio del partido en vivo

**User Story:** Como jugador o administrador, quiero iniciar el marcador en vivo desde un partido agendado, para que los demás usuarios puedan seguir el partido en tiempo real.

#### Acceptance Criteria

1. WHEN un Editor accede a un partido con `status = 'pending'` o `status = 'scheduled'`, THE System SHALL mostrar una opción para iniciar el marcador en vivo.
2. WHEN un Editor inicia el marcador en vivo, THE System SHALL actualizar el campo `status` del Match a `'live'` en la DB.
3. WHEN un Editor inicia el marcador en vivo, THE System SHALL crear un registro en `live_score_state` con el Match_State inicial: formato seleccionado, set 1, juegos 0-0, Point_Score 0-0, saque asignado al jugador 1, y Undo_Snapshot nulo.
4. WHEN un Editor inicia el marcador en vivo, THE System SHALL redirigir al Editor a la Hash_Route `/#live/match/:id` del partido.
5. IF un usuario sin rol de Editor intenta iniciar el marcador en vivo de un partido, THEN THE System SHALL denegar la acción y mostrar un mensaje indicando que no tiene permiso para iniciar el partido.
6. THE System SHALL considerar Editor al usuario cuyo `id` coincide con `home_player_id` del Match, al usuario cuyo `id` coincide con `away_player_id` del Match, a usuarios con `role = 'admin'` en `profiles`, y a usuarios registrados como Additional_Editor del partido.

---

### Requirement 2: Acceso y autenticación

**User Story:** Como usuario registrado, quiero acceder al marcador en vivo mediante una URL compartible, para poder seguir el partido desde cualquier dispositivo.

#### Acceptance Criteria

1. WHEN un usuario no autenticado accede a una Hash_Route `/#live/match/:id`, THE System SHALL redirigir al usuario a la pantalla de login y, tras autenticarse correctamente, redirigirlo al partido solicitado.
2. WHEN un usuario autenticado accede a una Hash_Route `/#live/match/:id` válida de un Live_Match, THE System SHALL mostrar el Scoreboard del partido en modo Viewer o Editor según los permisos del usuario.
3. IF la Hash_Route `/#live/match/:id` referencia un `id` que no existe en la tabla `matches`, THEN THE System SHALL mostrar un mensaje indicando que el partido no fue encontrado.
4. IF la Hash_Route `/#live/match/:id` referencia un partido con `status = 'played'`, THEN THE System SHALL mostrar el marcador final del partido en modo solo lectura.
5. THE Auth_Service SHALL gestionar la sesión del usuario de forma consistente con el resto de la aplicación PPC Tennis, sin crear un flujo de autenticación separado.

---

### Requirement 3: Visualización del marcador en tiempo real

**User Story:** Como Viewer, quiero ver el marcador actualizado en tiempo real sin recargar la página, para seguir el partido punto a punto.

#### Acceptance Criteria

1. WHEN el Match_State de un Live_Match cambia en la DB, THE Realtime_Service SHALL propagar el cambio a todos los clientes conectados a ese partido en menos de 3 segundos bajo condiciones normales de red.
2. THE Scoreboard SHALL mostrar el nombre de ambos jugadores, el Set_Score de cada set completado, el juego actual (games del set en curso por cada jugador), y el Point_Score del juego en curso.
3. THE Scoreboard SHALL mostrar el Serve_Indicator junto al nombre del jugador que tiene el saque en el momento actual.
4. WHILE un partido tiene `status = 'live'`, THE Scoreboard SHALL actualizar el marcador automáticamente al recibir cambios del Realtime_Service sin requerir acción del usuario.
5. THE Scoreboard SHALL mostrar el número de set actual y el historial de Set_Score de todos los sets completados.
6. IF la conexión del Realtime_Service se interrumpe, THEN THE System SHALL mostrar un indicador visual de estado de conexión al usuario e intentar reconectarse automáticamente.

---

### Requirement 4: Registro de puntos (modo Editor)

**User Story:** Como Editor, quiero registrar cada punto ganado por un jugador, para mantener el marcador actualizado en tiempo real.

#### Acceptance Criteria

1. WHEN un Editor registra un punto para un jugador, THE System SHALL calcular el nuevo Point_Score según las reglas del formato activo del partido.
2. WHEN el Point_Score de un jugador alcanza el valor que determina la victoria del juego según el formato activo, THE System SHALL incrementar el contador de juegos del jugador en el set actual y reiniciar el Point_Score a 0-0.
3. WHEN un jugador gana un juego y el Set_Score resultante determina la victoria del set según el formato activo, THE System SHALL registrar el set como completado, incrementar el contador de sets del jugador, y preparar el estado para el siguiente set.
4. WHEN un jugador gana un set y el número de sets ganados alcanza 2, THE System SHALL finalizar el partido según el Requirement 9.
5. WHEN el System calcula el nuevo Match_State tras un punto, THE System SHALL guardar el Match_State previo como Undo_Snapshot antes de persistir el nuevo estado.
6. WHEN el System calcula el nuevo Match_State tras un punto, THE System SHALL persistir el nuevo Match_State en el registro `live_score_state` correspondiente al partido en la DB.
7. THE System SHALL mostrar los controles de registro de puntos únicamente al usuario identificado como Editor del partido.

---

### Requirement 5: Lógica de puntuación estándar (Standard_Format)

**User Story:** Como Editor, quiero que el sistema aplique las reglas de puntuación del tenis estándar, para que el marcador sea correcto en todo momento.

#### Acceptance Criteria

1. WHERE el partido usa Standard_Format, THE System SHALL aplicar la secuencia de Point_Score: `0 → 15 → 30 → 40 → Game`.
2. WHERE el partido usa Standard_Format y ambos jugadores tienen Point_Score `40`, THE System SHALL establecer el estado del juego como `Deuce`.
3. WHERE el partido usa Standard_Format y el estado del juego es `Deuce`, WHEN un jugador gana un punto, THE System SHALL establecer el estado como `Ad` para ese jugador.
4. WHERE el partido usa Standard_Format y el estado del juego es `Ad`, WHEN el jugador con ventaja gana un punto, THE System SHALL registrar el juego como ganado por ese jugador.
5. WHERE el partido usa Standard_Format y el estado del juego es `Ad`, WHEN el jugador sin ventaja gana un punto, THE System SHALL volver al estado `Deuce`.
6. WHERE el partido usa Standard_Format y el Set_Score llega a 6-6, THE System SHALL iniciar un Tiebreak.
7. WHEN se juega un Tiebreak en Standard_Format, THE System SHALL aplicar la secuencia de puntos numéricos `0, 1, 2, ...` y registrar como ganador del Tiebreak al primer jugador que alcance 7 puntos con diferencia de 2 o más puntos sobre el rival.
8. WHEN un jugador gana el Tiebreak en Standard_Format, THE System SHALL registrar el Set_Score del set como 7-6 para el ganador del Tiebreak.

---

### Requirement 6: Lógica de puntuación NextGen (NextGen_Format)

**User Story:** Como Editor, quiero que el sistema soporte el formato NextGen (sets de 4 juegos, sin ventaja), para registrar partidos con este formato.

#### Acceptance Criteria

1. WHERE el partido usa NextGen_Format, THE System SHALL aplicar sets de 4 juegos en lugar de 6.
2. WHERE el partido usa NextGen_Format, THE System SHALL aplicar la secuencia de Point_Score: `0 → 15 → 30 → 40 → Game` sin estado `Deuce` ni `Ad`.
3. WHERE el partido usa NextGen_Format y ambos jugadores tienen Point_Score `40`, THE System SHALL jugar un punto de oro: el siguiente punto ganado por cualquier jugador determina el juego sin pasar por Deuce.
4. WHERE el partido usa NextGen_Format y el Set_Score llega a 4-4, THE System SHALL iniciar un Tiebreak de 7 puntos con diferencia de 2.
5. WHERE el partido usa NextGen_Format y el marcador del Tiebreak llega a 6-6, THE System SHALL jugar un punto de oro: el siguiente punto ganado determina el Tiebreak.

---

### Requirement 7: Lógica del Super Tiebreak (SuperTiebreak_Format)

**User Story:** Como Editor, quiero que el sistema soporte el Super Tiebreak como tercer set, para registrar partidos con este formato.

#### Acceptance Criteria

1. WHERE el partido usa SuperTiebreak_Format y los dos primeros sets terminan 1-1 en sets, THE System SHALL iniciar el tercer set como Super_Tiebreak en lugar de un set completo.
2. WHEN se juega un Super_Tiebreak, THE System SHALL aplicar la secuencia de puntos numéricos `0, 1, 2, ...` y registrar como ganador al primer jugador que alcance 10 puntos con diferencia de 2 o más puntos sobre el rival.
3. WHEN un jugador gana el Super_Tiebreak, THE System SHALL registrar el tercer set en `match_sets` con `p1_games` y `p2_games` iguales al marcador final de puntos del Super_Tiebreak (ej: p1_games=10, p2_games=8).
4. WHERE el partido usa SuperTiebreak_Format, THE System SHALL aplicar Standard_Format para los dos primeros sets.

---

### Requirement 8: Indicador de saque

**User Story:** Como Viewer o Editor, quiero ver en todo momento qué jugador tiene el saque, para seguir el partido con mayor contexto.

#### Acceptance Criteria

1. THE Scoreboard SHALL mostrar el Serve_Indicator junto al nombre del jugador que tiene el saque en el juego actual.
2. WHEN un juego termina en Standard_Format o NextGen_Format (fuera de Tiebreak o Super_Tiebreak), THE System SHALL alternar el saque al jugador contrario al que sacó en ese juego.
3. WHEN se inicia un Tiebreak o Super_Tiebreak, THE System SHALL asignar el primer saque al jugador que no sacó en el último juego del set.
4. WHEN se juega un Tiebreak o Super_Tiebreak, THE System SHALL alternar el saque cada 2 puntos, comenzando con 1 punto para el primer sacador del Tiebreak o Super_Tiebreak.
5. THE System SHALL persistir el Serve_Indicator como parte del Match_State en el registro `live_score_state` tras cada punto registrado.

---

### Requirement 9: Finalización del partido

**User Story:** Como Editor, quiero que al terminar el partido el resultado se guarde automáticamente, para no tener que introducirlo manualmente después.

#### Acceptance Criteria

1. WHEN un jugador alcanza 2 sets ganados, THE System SHALL actualizar el campo `status` del Match a `'played'` en la DB.
2. WHEN el partido finaliza, THE System SHALL guardar el resultado final en los campos `player1_sets_won`, `player2_sets_won`, `player1_games_won` y `player2_games_won` del Match en la DB.
3. WHEN el partido finaliza, THE System SHALL guardar el detalle de cada set en la tabla `match_sets` con los campos `set_number`, `p1_games` y `p2_games` para cada set jugado.
4. WHEN el partido finaliza, THE Scoreboard SHALL mostrar el marcador final y un mensaje recordatorio indicando que el Editor puede editar el partido después para agregar pintas o anécdota.
5. THE System SHALL mostrar el mensaje recordatorio de pintas y anécdota como texto informativo en el Scoreboard, sin abrir ningún modal automáticamente.
6. IF la escritura del resultado final en la DB falla, THEN THE System SHALL mostrar un mensaje de error al Editor indicando que el guardado falló y que debe intentarlo de nuevo.

---

### Requirement 10: Undo del último punto

**User Story:** Como Editor, quiero poder deshacer el último punto registrado, para corregir errores de entrada.

#### Acceptance Criteria

1. WHEN un Editor activa la acción Undo, THE System SHALL restaurar el Match_State al Undo_Snapshot guardado antes del último punto registrado.
2. WHEN un Editor activa la acción Undo, THE System SHALL persistir el Match_State restaurado en el registro `live_score_state` del partido en la DB.
3. THE System SHALL soportar únicamente 1 nivel de Undo (el último punto registrado).
4. IF no existe Undo_Snapshot disponible (inicio del partido o tras un Undo previo), THEN THE System SHALL deshabilitar visualmente el control de Undo.
5. THE System SHALL mostrar el control de Undo únicamente al Editor del partido.

---

### Requirement 11: Editores adicionales

**User Story:** Como Editor, quiero poder añadir usuarios adicionales como editores del partido, para que puedan registrar puntos en caso de que yo tenga problemas con mi dispositivo.

#### Acceptance Criteria

1. THE Scoreboard SHALL mostrar un control para añadir Additional_Editors únicamente al Editor del partido.
2. WHEN un Editor añade un usuario registrado como Additional_Editor, THE System SHALL persistir la lista de Additional_Editors en el registro `live_score_state` del partido en la DB.
3. WHEN un usuario autenticado accede a un Live_Match y su `id` está en la lista de Additional_Editors del partido, THE System SHALL mostrar el Scoreboard en modo Editor para ese usuario.
4. THE System SHALL permitir añadir como Additional_Editor únicamente a usuarios existentes en la tabla `profiles`.
5. IF un Editor intenta añadir un usuario que ya es Editor del partido, THEN THE System SHALL ignorar la acción sin mostrar un error.

---

### Requirement 12: Banner de partidos en vivo

**User Story:** Como usuario registrado, quiero ver un aviso cuando hay partidos en vivo, para poder acceder a ellos rápidamente desde cualquier vista de la app.

#### Acceptance Criteria

1. WHEN existe al menos un Match con `status = 'live'` en la DB, THE System SHALL mostrar un Banner en la interfaz principal de la app para todos los usuarios autenticados.
2. THE Banner SHALL mostrar el nombre de los jugadores de cada partido en vivo y un enlace a la Hash_Route `/#live/match/:id` correspondiente.
3. WHEN todos los partidos en vivo finalizan y no existe ningún Match con `status = 'live'`, THE System SHALL ocultar el Banner automáticamente.
4. WHILE hay partidos en vivo, THE Realtime_Service SHALL mantener el Banner actualizado con los partidos activos sin requerir recarga de página.
5. WHERE hay más de un partido en vivo simultáneamente, THE Banner SHALL mostrar el número de partidos en vivo y un enlace a la lista de partidos activos.

---

### Requirement 13: Compartir el partido

**User Story:** Como Editor o Viewer, quiero compartir el enlace del partido en vivo, para que otros usuarios registrados puedan seguirlo.

#### Acceptance Criteria

1. THE Scoreboard SHALL mostrar un botón de compartir accesible tanto para Editors como para Viewers.
2. WHEN un usuario activa el botón de compartir, THE System SHALL presentar las opciones de copiar el enlace al portapapeles y compartir por WhatsApp.
3. WHEN un usuario selecciona la opción de copiar enlace, THE System SHALL copiar la Hash_Route completa del partido al portapapeles del dispositivo y mostrar una confirmación visual.
4. WHEN un usuario selecciona la opción de compartir por WhatsApp, THE System SHALL abrir WhatsApp con un mensaje predefinido que incluya la Hash_Route del partido y los nombres de los jugadores.
5. IF el navegador no soporta la API de portapapeles, THEN THE System SHALL mostrar la URL en un campo de texto para que el usuario pueda copiarla manualmente.

---

### Requirement 14: Selección de formato al iniciar

**User Story:** Como Editor, quiero seleccionar el formato del partido al iniciar el marcador en vivo, para que la lógica de puntuación sea correcta desde el primer punto.

#### Acceptance Criteria

1. WHEN un Editor inicia el marcador en vivo, THE System SHALL solicitar la selección del formato del partido antes de inicializar el Match_State.
2. THE System SHALL ofrecer los siguientes formatos seleccionables: Standard (Mejor de 3, sets de 6 juegos con ventaja), NextGen (Mejor de 3, sets de 4 juegos sin ventaja), y Super Tiebreak (Mejor de 3, tercer set como Super_Tiebreak de 10 puntos).
3. WHEN un Editor selecciona un formato, THE System SHALL persistir el formato seleccionado como parte del Match_State en el registro `live_score_state` en la DB.
4. THE System SHALL aplicar la lógica de puntuación correspondiente al formato persistido durante toda la duración del partido.

---

### Requirement 15: Persistencia y consistencia del estado

**User Story:** Como Editor o Viewer, quiero que el marcador sea consistente aunque recargue la página, para no perder el estado del partido.

#### Acceptance Criteria

1. WHEN un usuario recarga la página en una Hash_Route `/#live/match/:id` de un Live_Match, THE System SHALL recuperar el Match_State actual desde el registro `live_score_state` en la DB y mostrar el Scoreboard en el estado correcto.
2. THE System SHALL persistir el Match_State completo en el registro `live_score_state` de la DB tras cada punto registrado.
3. THE Match_State persistido SHALL contener como mínimo: formato del partido, set actual, juegos del set actual por jugador, Point_Score actual, sets ganados por jugador, historial de Set_Score de sets completados, jugador con el saque, lista de Additional_Editors, y Undo_Snapshot.
4. IF la operación de persistencia del Match_State en la DB falla tras registrar un punto, THEN THE System SHALL mostrar un mensaje de error al Editor indicando que el punto no fue guardado.

---

### Requirement 16: Visibilidad de la feature (Fase 1)

**User Story:** Como administrador, quiero que el Live Scoreboard no sea visible en la navegación pública durante la Fase 1, para poder validar su funcionamiento antes de exponerlo a todos los usuarios.

#### Acceptance Criteria

1. THE System SHALL no mostrar ningún enlace ni botón de acceso al Live Scoreboard en la navegación principal de la app durante la Fase 1.
2. WHEN un usuario con `role = 'admin'` está autenticado, THE System SHALL permitir el acceso al Live Scoreboard mediante la Hash_Route `/#live/match/:id` directa.
3. WHEN cualquier usuario autenticado accede a una Hash_Route `/#live/match/:id` válida, THE System SHALL mostrar el Scoreboard independientemente de si la feature está expuesta en la navegación.
4. THE System SHALL mostrar el Banner de partidos en vivo únicamente a usuarios con `role = 'admin'` durante la Fase 1.
