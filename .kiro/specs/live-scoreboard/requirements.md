# Requirements Document

## Introduction

El Live Scoreboard es una funcionalidad de PPC Tennis que permite registrar y visualizar el marcador de un partido de tenis en tiempo real, punto a punto. Un jugador o administrador inicia el marcador desde un partido ya agendado, y cualquier usuario registrado puede seguirlo en vivo desde una URL compartible. El sistema soporta los formatos Singles Mejor de 3 (sets de 6 juegos), NextGen (sets de 4 juegos, sin ventaja) y Super Tiebreak (10 puntos). Al finalizar, el resultado se guarda automáticamente en la base de datos y el partido pasa a estado `played`.

---

## Glossary

- **Scoreboard**: El componente visual que muestra el marcador en tiempo real.
- **Editor**: Usuario con permiso para registrar puntos — los dos jugadores del partido o un administrador.
- **Viewer**: Usuario registrado que observa el partido en tiempo real sin poder editar.
- **Match**: Registro en la tabla `matches` de Supabase.
- **Live Match**: Partido con `status = 'live'` en la tabla `matches`.
- **Match_State**: Estado completo del marcador en un momento dado (set actual, juego actual, puntos actuales, saque, undo snapshot).
- **Live_State**: Columna JSONB en `matches` que almacena el Match_State actual.
- **Point_Score**: Representación textual del marcador de puntos dentro de un juego: `0`, `15`, `30`, `40`, `Deuce`, `Ad` (ventaja).
- **Set_Score**: Par de números que representa los juegos ganados por cada jugador en un set.
- **Tiebreak**: Juego especial que se juega cuando el Set_Score llega a 6-6 (formato estándar) o 4-4 (NextGen). Se gana al llegar a 7 puntos con diferencia de 2 (o 10 puntos en Super Tiebreak).
- **Super_Tiebreak**: Tercer set especial de 10 puntos (con diferencia de 2) que reemplaza al tercer set completo.
- **NextGen_Format**: Formato de sets de 4 juegos sin ventaja (punto de oro en Deuce).
- **Standard_Format**: Formato de sets de 6 juegos con tiebreak en 6-6.
- **Serve_Indicator**: Indicador visual de qué jugador tiene el saque en el momento actual.
- **Undo**: Acción que revierte el último punto registrado.
- **Undo_Snapshot**: Copia del Match_State anterior al último punto, usada para implementar el Undo de un nivel.
- **Hash_Route**: URL con formato `/#live/match/:id` que identifica un partido en vivo.
- **Banner**: Componente visual persistente en la app que notifica la existencia de partidos en vivo.
- **System**: El sistema Live Scoreboard de PPC Tennis.
- **Auth_Service**: El servicio de autenticación de Supabase.
- **Realtime_Service**: El servicio de Supabase Realtime que propaga cambios de la tabla `matches`.
- **DB**: La base de datos PostgreSQL de Supabase.

---

## Requirements

### Requirement 1: Inicio del partido en vivo

**User Story:** Como jugador o administrador, quiero iniciar el marcador en vivo desde un partido agendado, para que los demás usuarios puedan seguir el partido en tiempo real.

#### Acceptance Criteria

1. WHEN un Editor accede a un partido con `status = 'pending'` o `status = 'scheduled'`, THE System SHALL mostrar una opción para iniciar el marcador en vivo.
2. WHEN un Editor inicia el marcador en vivo, THE System SHALL actualizar el campo `status` del Match a `'live'` en la DB.
3. WHEN un Editor inicia el marcador en vivo, THE System SHALL inicializar el Live_State con el Match_State inicial: set 1, juego 0-0, puntos 0-0, saque asignado al jugador 1.
4. WHEN un Editor inicia el marcador en vivo, THE System SHALL redirigir al Editor a la Hash_Route `/#live/match/:id` del partido.
5. IF un usuario sin rol de Editor intenta iniciar el marcador en vivo de un partido, THEN THE System SHALL denegar la acción y mostrar un mensaje de error.
6. THE System SHALL considerar Editor únicamente al jugador registrado como `home_player_id`, al jugador registrado como `away_player_id`, y a usuarios con `role = 'admin'` en la tabla `profiles`.

---

### Requirement 2: Acceso y autenticación

**User Story:** Como usuario registrado, quiero acceder al marcador en vivo mediante una URL compartible, para poder seguir el partido desde cualquier dispositivo.

#### Acceptance Criteria

1. WHEN un usuario no autenticado accede a una Hash_Route `/#live/match/:id`, THE System SHALL redirigir al usuario a la pantalla de login antes de mostrar el Scoreboard.
2. WHEN un usuario autenticado accede a una Hash_Route `/#live/match/:id` válida, THE System SHALL mostrar el Scoreboard del partido correspondiente.
3. IF la Hash_Route `/#live/match/:id` referencia un partido que no existe en la DB, THEN THE System SHALL mostrar un mensaje de error indicando que el partido no fue encontrado.
4. IF la Hash_Route `/#live/match/:id` referencia un partido con `status` distinto de `'live'`, THEN THE System SHALL mostrar el marcador final del partido en modo solo lectura.
5. THE Auth_Service SHALL gestionar la sesión del usuario de forma consistente con el resto de la aplicación PPC Tennis.

---

### Requirement 3: Visualización del marcador en tiempo real

**User Story:** Como Viewer, quiero ver el marcador actualizado en tiempo real sin recargar la página, para seguir el partido punto a punto.

#### Acceptance Criteria

1. WHEN el Live_State de un Match cambia en la DB, THE Realtime_Service SHALL propagar el cambio a todos los Viewers conectados a ese partido en menos de 3 segundos.
2. THE Scoreboard SHALL mostrar el nombre de ambos jugadores, el Set_Score de cada set jugado, el juego actual (games del set en curso), y el Point_Score del juego en curso.
3. THE Scoreboard SHALL mostrar el Serve_Indicator junto al nombre del jugador que tiene el saque en el momento actual.
4. WHILE un partido tiene `status = 'live'`, THE Scoreboard SHALL actualizar el marcador automáticamente al recibir cambios del Realtime_Service sin requerir acción del usuario.
5. THE Scoreboard SHALL mostrar el número de set actual y el historial de Set_Score de sets completados.

---

### Requirement 4: Registro de puntos (modo Editor)

**User Story:** Como Editor, quiero registrar cada punto ganado por un jugador, para mantener el marcador actualizado en tiempo real.

#### Acceptance Criteria

1. WHEN un Editor registra un punto para un jugador, THE System SHALL calcular el nuevo Point_Score según las reglas del formato activo (Standard_Format o NextGen_Format).
2. WHEN el Point_Score de un jugador alcanza el valor que determina la victoria del juego según el formato activo, THE System SHALL incrementar el contador de juegos del jugador en el set actual y reiniciar el Point_Score a 0-0.
3. WHEN un jugador gana un juego y el Set_Score resultante determina la victoria del set según el formato activo, THE System SHALL registrar el set como ganado, incrementar el contador de sets del jugador, e iniciar un nuevo set.
4. WHEN un jugador gana un set y el número de sets ganados alcanza el valor requerido para ganar el partido (2 en Mejor de 3), THE System SHALL finalizar el partido automáticamente según el Requirement 9.
5. WHEN el System registra un punto, THE System SHALL guardar el Undo_Snapshot con el Match_State previo al punto registrado.
6. WHEN el System registra un punto, THE System SHALL persistir el nuevo Match_State en el campo Live_State del Match en la DB.
7. THE System SHALL mostrar únicamente los controles de registro de puntos al usuario identificado como Editor del partido.

---

### Requirement 5: Lógica de puntuación estándar (Standard_Format)

**User Story:** Como Editor, quiero que el sistema aplique las reglas de puntuación del tenis estándar, para que el marcador sea correcto en todo momento.

#### Acceptance Criteria

1. THE System SHALL aplicar la secuencia de Point_Score: `0 → 15 → 30 → 40 → Game` para el Standard_Format.
2. WHEN ambos jugadores tienen Point_Score `40`, THE System SHALL establecer el estado del juego como `Deuce`.
3. WHEN el estado del juego es `Deuce` y un jugador gana un punto, THE System SHALL establecer el estado como `Ad` para ese jugador.
4. WHEN el estado del juego es `Ad` y el jugador con ventaja gana un punto, THE System SHALL registrar el juego como ganado por ese jugador.
5. WHEN el estado del juego es `Ad` y el jugador sin ventaja gana un punto, THE System SHALL volver al estado `Deuce`.
6. WHEN el Set_Score llega a 6-6 en Standard_Format, THE System SHALL iniciar un Tiebreak.
7. WHEN se juega un Tiebreak, THE System SHALL aplicar la secuencia de puntos: `0 → 1 → 2 → ... → 7` (o más), y el primer jugador en llegar a 7 puntos con diferencia de 2 o más gana el Tiebreak.
8. WHEN un jugador gana el Tiebreak, THE System SHALL registrar el set con Set_Score 7-6 para el ganador.

---

### Requirement 6: Lógica de puntuación NextGen (NextGen_Format)

**User Story:** Como Editor, quiero que el sistema soporte el formato NextGen (sets de 4 juegos, sin ventaja), para registrar partidos con este formato.

#### Acceptance Criteria

1. WHERE el partido usa NextGen_Format, THE System SHALL aplicar sets de 4 juegos en lugar de 6.
2. WHERE el partido usa NextGen_Format, THE System SHALL aplicar la secuencia de Point_Score: `0 → 15 → 30 → 40 → Game`, sin estado `Deuce` ni `Ad`.
3. WHERE el partido usa NextGen_Format y ambos jugadores tienen Point_Score `40`, THE System SHALL jugar un punto de oro: el siguiente punto ganado determina el juego (sin Deuce).
4. WHERE el partido usa NextGen_Format y el Set_Score llega a 4-4, THE System SHALL iniciar un Tiebreak de 7 puntos con diferencia de 2.
5. WHERE el partido usa NextGen_Format y el Set_Score del Tiebreak llega a 6-6, THE System SHALL jugar un punto de oro: el siguiente punto ganado determina el Tiebreak.

---

### Requirement 7: Lógica del Super Tiebreak

**User Story:** Como Editor, quiero que el sistema soporte el Super Tiebreak como tercer set, para registrar partidos con este formato.

#### Acceptance Criteria

1. WHERE el partido usa Super_Tiebreak y los dos primeros sets terminan 1-1, THE System SHALL iniciar el tercer set como Super_Tiebreak en lugar de un set completo.
2. WHEN se juega un Super_Tiebreak, THE System SHALL aplicar la secuencia de puntos: `0 → 1 → 2 → ... → 10` (o más), y el primer jugador en llegar a 10 puntos con diferencia de 2 o más gana el Super_Tiebreak.
3. WHEN un jugador gana el Super_Tiebreak, THE System SHALL registrar el tercer set con el marcador de puntos del Super_Tiebreak (ej: 10-8) y finalizar el partido.

---

### Requirement 8: Indicador de saque

**User Story:** Como Viewer o Editor, quiero ver en todo momento qué jugador tiene el saque, para seguir el partido con mayor contexto.

#### Acceptance Criteria

1. THE Scoreboard SHALL mostrar el Serve_Indicator junto al nombre del jugador que tiene el saque en el juego actual.
2. WHEN un juego termina en Standard_Format o NextGen_Format (excepto Tiebreak), THE System SHALL alternar el saque al jugador contrario.
3. WHEN se inicia un Tiebreak o Super_Tiebreak, THE System SHALL asignar el saque al jugador que no sacó en el último juego del set.
4. WHEN se juega un Tiebreak o Super_Tiebreak, THE System SHALL alternar el saque cada 2 puntos, comenzando con 1 punto para el primer sacador.
5. THE System SHALL persistir el Serve_Indicator como parte del Match_State en el Live_State.

---

### Requirement 9: Finalización del partido

**User Story:** Como Editor, quiero que al terminar el partido el resultado se guarde automáticamente, para no tener que introducirlo manualmente después.

#### Acceptance Criteria

1. WHEN un jugador gana el número de sets requerido para ganar el partido, THE System SHALL actualizar el campo `status` del Match a `'played'` en la DB.
2. WHEN el partido finaliza, THE System SHALL guardar el resultado final en los campos `player1_sets_won`, `player2_sets_won`, `player1_games_won`, `player2_games_won` del Match en la DB.
3. WHEN el partido finaliza, THE System SHALL guardar el detalle de cada set en la tabla `match_sets` con los campos `set_number`, `p1_games`, `p2_games`.
4. WHEN el partido finaliza, THE System SHALL mostrar el marcador final en el Scoreboard con un mensaje que recuerde al Editor editar las pints y la anécdota del partido.
5. THE System SHALL mostrar el mensaje recordatorio de pints y anécdota como texto informativo en el Scoreboard, sin abrir ningún modal automáticamente.
6. IF la escritura del resultado final en la DB falla, THEN THE System SHALL mostrar un mensaje de error al Editor e indicar que debe intentarlo de nuevo.

---

### Requirement 10: Undo del último punto

**User Story:** Como Editor, quiero poder deshacer el último punto registrado, para corregir errores de entrada.

#### Acceptance Criteria

1. WHEN un Editor activa la acción Undo, THE System SHALL restaurar el Match_State al Undo_Snapshot guardado antes del último punto.
2. WHEN un Editor activa la acción Undo, THE System SHALL persistir el Match_State restaurado en el Live_State del Match en la DB.
3. THE System SHALL soportar únicamente 1 nivel de Undo (el último punto registrado).
4. IF no existe Undo_Snapshot disponible (inicio del partido), THEN THE System SHALL deshabilitar la acción Undo.
5. THE System SHALL mostrar el control de Undo únicamente al Editor del partido.

---

### Requirement 11: Banner de partidos en vivo

**User Story:** Como usuario registrado, quiero ver un aviso cuando hay partidos en vivo, para poder acceder a ellos rápidamente desde cualquier vista de la app.

#### Acceptance Criteria

1. WHEN existe al menos un Match con `status = 'live'` en la DB, THE System SHALL mostrar un Banner en la interfaz principal de la app.
2. THE Banner SHALL mostrar el nombre de los jugadores del partido en vivo y un enlace a la Hash_Route `/#live/match/:id` correspondiente.
3. WHEN todos los partidos en vivo finalizan y no existe ningún Match con `status = 'live'`, THE System SHALL ocultar el Banner.
4. WHILE hay partidos en vivo, THE Realtime_Service SHALL mantener el Banner actualizado con los partidos activos sin requerir recarga de página.
5. WHERE hay más de un partido en vivo simultáneamente, THE Banner SHALL mostrar todos los partidos activos o un indicador del número de partidos en vivo con acceso a la lista.

---

### Requirement 12: Compartir el partido

**User Story:** Como Editor o Viewer, quiero compartir el enlace del partido en vivo, para que otros usuarios registrados puedan seguirlo.

#### Acceptance Criteria

1. THE Scoreboard SHALL mostrar un botón de compartir accesible tanto para Editors como para Viewers.
2. WHEN un usuario activa el botón de compartir, THE System SHALL presentar las opciones: copiar el enlace al portapapeles y compartir por WhatsApp.
3. WHEN un usuario selecciona "Copiar enlace", THE System SHALL copiar la Hash_Route completa del partido al portapapeles del dispositivo y mostrar una confirmación visual.
4. WHEN un usuario selecciona "Compartir por WhatsApp", THE System SHALL abrir WhatsApp con un mensaje predefinido que incluya la Hash_Route del partido.
5. IF el navegador no soporta la API de portapapeles, THEN THE System SHALL mostrar la URL en un campo de texto para que el usuario pueda copiarla manualmente.

---

### Requirement 13: Selección de formato al iniciar

**User Story:** Como Editor, quiero seleccionar el formato del partido al iniciar el marcador en vivo, para que la lógica de puntuación sea correcta.

#### Acceptance Criteria

1. WHEN un Editor inicia el marcador en vivo, THE System SHALL solicitar la selección del formato del partido antes de inicializar el Match_State.
2. THE System SHALL ofrecer los siguientes formatos: Standard (Mejor de 3, sets de 6 juegos), NextGen (Mejor de 3, sets de 4 juegos, sin ventaja), y Super Tiebreak (Mejor de 3, tercer set como Super_Tiebreak de 10 puntos).
3. WHEN un Editor selecciona un formato, THE System SHALL persistir el formato seleccionado como parte del Live_State en la DB.
4. THE System SHALL aplicar la lógica de puntuación correspondiente al formato persistido durante toda la duración del partido.

---

### Requirement 14: Persistencia y consistencia del estado

**User Story:** Como Editor o Viewer, quiero que el marcador sea consistente aunque recargue la página, para no perder el estado del partido.

#### Acceptance Criteria

1. WHEN un usuario recarga la página en una Hash_Route `/#live/match/:id` de un partido en vivo, THE System SHALL recuperar el Match_State actual desde el Live_State almacenado en la DB y mostrar el Scoreboard en el estado correcto.
2. THE System SHALL almacenar el Match_State completo en el campo Live_State (JSONB) del Match en la DB tras cada punto registrado.
3. IF la conexión del Realtime_Service se interrumpe, THEN THE System SHALL intentar reconectarse automáticamente y mostrar un indicador visual de estado de conexión al Viewer.
4. THE Live_State SHALL contener como mínimo: formato del partido, set actual, juegos del set actual por jugador, Point_Score actual, sets ganados por jugador, historial de Set_Score de sets completados, jugador con el saque, y Undo_Snapshot.
