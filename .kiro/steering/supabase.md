# Supabase - Base de Datos PPC

## Conexión

- **Proyecto:** PintaPost Championship (PPC)
- **URL:** `https://tzmbznenarrpjayntyjt.supabase.co`
- **Anon key:** en `.env.local` como `VITE_SUPABASE_ANON_KEY`
- **Service role key:** en `.env.local` como `SUPABASE_SERVICE_ROLE_KEY` (acceso total, nunca subir a GitHub)
- **Personal Access Token:** en `.env.local` como `SUPABASE_ACCESS_TOKEN` (para MCP server)

El cliente se inicializa en `src/lib/supabaseClient.ts` usando las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

Para consultas directas desde terminal (sin RLS), usar la service role key.

El MCP server de Supabase está configurado en `~/.kiro/settings/mcp.json` con `project_ref=tzmbznenarrpjayntyjt`.

---

## Tablas

### `profiles`
Jugadores registrados en la plataforma.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK, vinculado a auth.users |
| name | text | Nombre completo |
| email | varchar | Email del jugador |
| role | text | `player` o `admin` |
| avatar_url | text | URL del avatar en Supabase Storage |
| nickname | text | Apodo del jugador (ej: JFones) |
| postal_code | text | Código postal |
| created_at | timestamp | Fecha de registro |

---

### `tournaments`
Ediciones/temporadas del torneo PPC.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| name | text | Nombre (ej: "PPC Edición 1 (2024 Verano)") |
| season | text | Código de temporada (ej: "PPC 1") |
| start_date | date | Fecha de inicio |
| end_date | date | Fecha de fin |
| status | text | `active`, `finished`, `upcoming` |
| format | text | `league`, `knockout`, etc. Default: `league` |
| sort_order | int | Orden de visualización. Default: 0 |

---

### `divisions`
Divisiones dentro de cada torneo (Cobre, Plata, Oro, etc.).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| name | text | Nombre (ej: "Cobre", "Plata", "Oro") |
| color | text | Color hex (ej: "#a16207") |
| capacity | int | Capacidad máxima de jugadores. Default: 12 |
| direct_promotion_slots | int | Plazas de ascenso directo (≥0) |
| promotion_playoff_slots | int | Plazas de playoff de ascenso (≥0) |
| relegation_playoff_slots | int | Plazas de playoff de descenso (≥0) |
| direct_relegation_slots | int | Plazas de descenso directo (≥0) |

---

### `tournament_registrations`
Inscripciones de jugadores a torneos/divisiones.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| division_id | uuid | FK → divisions |
| profile_id | uuid | FK → profiles (nullable si es historic) |
| historic_player_id | uuid | FK → historic_players (jugadores sin cuenta) |
| seed | int | Posición de siembra |
| status | text | `active` o `retired` |
| created_at | timestamp | Fecha de inscripción |

---

### `matches`
Partidos jugados o programados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| division_id | uuid | FK → divisions |
| home_player_id | uuid | FK → profiles |
| away_player_id | uuid | FK → profiles |
| home_historic_player_id | uuid | FK → historic_players |
| away_historic_player_id | uuid | FK → historic_players |
| date | timestamp | Fecha del partido |
| time | text | Hora |
| location_id | uuid | FK → locations |
| location_details | text | Detalles adicionales de ubicación |
| time_block | text | Bloque horario |
| status | text | Default: `scheduled` (también `played`, `pending`, `cancelled`) |
| player1_sets_won | int | Sets ganados por jugador 1 |
| player2_sets_won | int | Sets ganados por jugador 2 |
| player1_games_won | int | Games ganados por jugador 1 |
| player2_games_won | int | Games ganados por jugador 2 |
| player1_had_pint | bool | Si jugador 1 tomó una pinta |
| player2_had_pint | bool | Si jugador 2 tomó una pinta |
| player1_pints | int | Pintas de jugador 1 |
| player2_pints | int | Pintas de jugador 2 |
| knockout_round | text | Ronda en formato knockout |
| bracket_position | int | Posición en el bracket |
| phase | text | Fase del torneo |
| group_code | text | Código de grupo |
| anecdote | text | Anécdota del partido (máx 50 palabras) |
| created_by | uuid | FK → profiles (quién cargó el resultado) |
| created_at | timestamp | Fecha de creación |

---

### `match_sets`
Sets individuales de cada partido.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| match_id | uuid | FK → matches |
| set_number | int | Número de set (1–5) |
| p1_games | int | Games del jugador 1 |
| p2_games | int | Games del jugador 2 |

---

### `locations`
Canchas/ubicaciones donde se juegan los partidos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| name | text | Nombre único (ej: "South") |

---

### `historic_players`
Jugadores que participaron antes de tener cuenta en la plataforma.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| name | text | Nombre completo |
| email | text | Email ficticio local |
| avatar_url | text | URL del avatar |
| created_at | timestamp | Fecha de creación |

---

### `availability`
Disponibilidad horaria de los jugadores.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| profile_id | uuid | FK → profiles |
| day_of_week | int | Día (0=domingo, 1=lunes, ..., 6=sábado) |
| start_time | time | Hora de inicio |
| end_time | time | Hora de fin |
| location_id | uuid | FK → locations |
| slot | text | `morning`, `afternoon` o `evening` |
| is_available | bool | Si está disponible. Default: true |

---

### `profile_locations`
Relación entre jugadores y las canchas donde suelen jugar.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| profile_id | uuid | FK → profiles |
| location_id | uuid | FK → locations |

---

### `player_cards`
Ficha/perfil extendido de cada jugador (estilo carta de tenista).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| profile_id | uuid | PK, FK → profiles |
| nickname | text | Apodo |
| age | int | Edad (5–100) |
| birth_date | date | Fecha de nacimiento |
| weight_kg | numeric | Peso en kg (20–250) |
| height_cm | numeric | Altura en cm (80–250) |
| nationality | text | Nacionalidad |
| birth_place | text | Lugar de nacimiento |
| dominant_hand | text | Mano dominante |
| backhand_style | text | Estilo de revés |
| ppc_objective | text | Objetivo en el PPC |
| favourite_shot | text | Golpe favorito |
| favourite_surface | text | Superficie favorita |
| favourite_player | text | Jugador favorito |
| racket_brand | text | Marca de raqueta |
| racket_model | text | Modelo de raqueta |
| tennis_start_year | int | Año en que empezó a jugar tenis |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Fecha de última actualización |

---

### `social_events`
Eventos sociales del PPC (cenas, celebraciones, etc.).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| title | text | Título del evento |
| description | text | Descripción |
| date | date | Fecha del evento |
| time | text | Hora |
| venue | text | Lugar |
| image_url | text | URL de imagen |
| rsvp_url | text | URL para confirmar asistencia |
| is_active | bool | Si está activo. Default: true |
| created_by | uuid | FK → profiles |
| created_at | timestamp | Fecha de creación |

---

### `booking_admins`
Usuarios con permisos para gestionar reservas de canchas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| profile_id | uuid | FK → profiles |
| role | text | `booker`, `admin` o `viewer` |
| is_active | bool | Si está activo. Default: true |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Fecha de actualización |

---

### `booking_accounts`
Cuentas de plataformas externas (Better, etc.) usadas para reservar canchas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| label | text | Nombre único de la cuenta |
| env_username_key | text | Nombre de la variable de entorno con el usuario |
| env_password_key | text | Nombre de la variable de entorno con la contraseña |
| owner_profile_id | uuid | FK → profiles (propietario de la cuenta) |
| is_active | bool | Si está activa. Default: true |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Fecha de actualización |

---

### `court_booking_requests`
Solicitudes automáticas de reserva de canchas (bot de reservas).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| better_account_id | uuid | FK → booking_accounts |
| profile_id | uuid | FK → profiles |
| venue_slug | text | Slug del venue en Better |
| activity_slug | text | Slug de la actividad |
| target_date | date | Fecha objetivo de la reserva |
| target_start_time | time | Hora de inicio deseada |
| target_end_time | time | Hora de fin deseada |
| search_start_date | date | Fecha desde la que empieza a buscar |
| search_window_start_time | time | Inicio de la ventana de búsqueda |
| search_window_end_time | time | Fin de la ventana de búsqueda |
| preferred_court_name_1 | text | Primera preferencia de cancha |
| preferred_court_name_2 | text | Segunda preferencia de cancha |
| preferred_court_name_3 | text | Tercera preferencia de cancha |
| status | text | `PENDING`, `SEARCHING`, `BOOKED`, `FAILED`, `EXPIRED`, `CANCELLED` |
| booked_court_name | text | Cancha efectivamente reservada |
| booked_slot_start | timestamp | Inicio del slot reservado |
| booked_slot_end | timestamp | Fin del slot reservado |
| last_run_at | timestamp | Último intento del bot |
| attempt_count | int | Número de intentos. Default: 0 |
| last_error | text | Último error registrado |
| is_active | bool | Si la solicitud está activa. Default: true |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Fecha de actualización |

---

### `live_score_state`
Estado en tiempo real del marcador de un partido en curso.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| match_id | uuid | FK → matches (único) |
| p1_sets | int | Sets ganados por jugador 1 |
| p2_sets | int | Sets ganados por jugador 2 |
| p1_games | int | Games en el set actual (jugador 1) |
| p2_games | int | Games en el set actual (jugador 2) |
| p1_points | int | Puntos en el game actual (jugador 1) |
| p2_points | int | Puntos en el game actual (jugador 2) |
| server | int | Quién saca: 1 o 2 |
| in_tiebreak | bool | Si están en tiebreak |
| in_super_tiebreak | bool | Si están en super tiebreak |
| completed_sets | jsonb | Array de sets completados con scores |
| previous_state | jsonb | Estado anterior (para deshacer) |
| format | text | Formato del partido. Default: `standard` |
| best_of | int | Número de sets (best of). Default: 3 |
| editor_ids | uuid[] | IDs de usuarios que pueden editar el marcador |
| status | text | `live`, `finished`, etc. Default: `live` |
| previous_match_status | text | Estado previo del match. Default: `scheduled` |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Fecha de última actualización |

---

## Notas importantes

- RLS (Row Level Security) está activo en todas las tablas. La anon key solo lee datos públicos.
- Para operaciones admin (updates, inserts sin auth) usar la service role key desde terminal.
- Storage bucket `avatars` contiene las fotos de perfil de los jugadores.
- Los `historic_players` son jugadores legacy sin cuenta, referenciados en matches con `home_historic_player_id` / `away_historic_player_id`.
- `player_cards` usa `profile_id` como PK (relación 1:1 con profiles).
- `live_score_state` tiene un único registro activo por partido (`match_id` es unique).
- `court_booking_requests` es el sistema de reservas automáticas de canchas (bot).
- `booking_accounts` almacena referencias a credenciales externas via variables de entorno, nunca las credenciales directamente.
