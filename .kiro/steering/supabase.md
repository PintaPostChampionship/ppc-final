# Supabase - Base de Datos PPC

## Conexión

- **Proyecto:** PintaPost Championship (PPC)
- **URL:** `https://tzmbznenarrpjayntyjt.supabase.co`
- **Anon key:** en `.env.local` como `VITE_SUPABASE_ANON_KEY`
- **Service role key:** en `.env.local` como `SUPABASE_SERVICE_ROLE_KEY` (acceso total, nunca subir a GitHub)

El cliente se inicializa en `src/lib/supabaseClient.ts` usando las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

Para consultas directas desde terminal (sin RLS), usar la service role key.

---

## Tablas

### `profiles`
Jugadores registrados en la plataforma.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK, vinculado a auth.users |
| name | text | Nombre completo |
| email | text | Email del jugador |
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
| format | text | `league`, `knockout`, etc. |
| sort_order | int | Orden de visualización |

---

### `divisions`
Divisiones dentro de cada torneo (Cobre, Plata, Oro, etc.).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| name | text | Nombre (ej: "Cobre", "Plata", "Oro") |
| color | text | Color hex (ej: "#a16207") |
| capacity | int | Capacidad máxima de jugadores |
| direct_promotion_slots | int | Plazas de ascenso directo |
| promotion_playoff_slots | int | Plazas de playoff de ascenso |
| relegation_playoff_slots | int | Plazas de playoff de descenso |
| direct_relegation_slots | int | Plazas de descenso directo |

---

### `tournament_registrations`
Inscripciones de jugadores a torneos/divisiones.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| division_id | uuid | FK → divisions |
| profile_id | uuid | FK → profiles |
| historic_player_id | uuid | FK → historic_players (jugadores sin cuenta) |
| seed | int | Posición de siembra |
| status | text | `active`, `withdrawn`, etc. |
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
| status | text | `played`, `pending`, `cancelled` |
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
| anecdote | text | Anécdota del partido |
| created_by | uuid | FK → profiles (quién cargó el resultado) |
| created_at | timestamp | Fecha de creación |

---

### `match_sets`
Sets individuales de cada partido.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| match_id | uuid | FK → matches |
| set_number | int | Número de set (1, 2, 3) |
| p1_games | int | Games del jugador 1 |
| p2_games | int | Games del jugador 2 |

---

### `locations`
Canchas/ubicaciones donde se juegan los partidos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| name | text | Nombre (ej: "South") |

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
| slot | text | Slot específico |
| is_available | bool | Si está disponible |

---

## Notas importantes

- RLS (Row Level Security) está activo. La anon key solo lee datos públicos.
- Para operaciones admin (updates, inserts sin auth) usar la service role key desde terminal.
- Storage bucket `avatars` contiene las fotos de perfil de los jugadores.
- Los `historic_players` son jugadores legacy sin cuenta, referenciados en matches con `home_historic_player_id` / `away_historic_player_id`.
