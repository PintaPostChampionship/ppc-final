# Court Finder — "Spin Tennis" Personal

## Visión

Monitor de disponibilidad de canchas de tenis en Londres, estilo Spin Tennis. Vista privada en ppctennis.vercel.app con mapa interactivo, filtros, alertas y (futuro) booking automático.

---

## Estado actual (Mayo 2026)

### ✅ Fase 1 — Monitor de disponibilidad + Mapa (COMPLETADO)

**Backend** (`book-better-bot/court_monitor/`):
- 13 venues configurados, 3 plataformas (Better, ClubSpark, Flow)
- Scraper paralelo: ~30 segundos para 13 venues × 7 días = 2000+ slots
- JSON generado: `data/court_availability.json`
- GitHub Action: cada 6h (configurable, bajar a 1h/30min cuando estable)

**Frontend** (`ppc-final/src/components/CourtFinder.tsx`):
- Mapa Leaflet interactivo con geolocation
- Buscador de canchas (autocomplete → navega el mapa)
- Filtros: fecha (pills), bloque horario, venue (multi-select), plataforma
- Venue cards colapsables con slots agrupados por hora
- Botón "Reservar" → link directo al checkout de cada plataforma
- Botón "📍" → Google Maps para ver distancia
- Botón "📍 Mi ubicación" en el mapa
- Botón "Todos" para ver todas las canchas
- Mapa controla la lista (mover mapa = actualizar venues abajo)
- Responsive: funciona en mobile y desktop

**Alertas** (UI completada, backend pendiente):
- Tabla `court_watchlist` en Supabase
- Botón "🔔 Crear alerta ▼" en cada venue
- Panel desplegable: seleccionar fecha + horas específicas
- Horas verdes = disponibles, grises = ocupadas (seleccionables para alerta)
- Multi-selección de horas, guardar batch

### 🔲 Fase 2b — Backend de alertas (PENDIENTE)
- Comparar JSON actual vs `court_watchlist` activa
- Si slot coincide → push notification via `/api/send-notification`
- Payload: venue, hora, link directo de booking
- Integrar en GitHub Action o Vercel cron

### 🔲 Fase 3 — Booking automático
- Better: reutilizar `LiveBetterClient` (add_to_cart → checkout)
- ClubSpark: generar link directo al checkout (pago manual ~15 seg)
- Notificación con link de pago al completar

### 🔲 Fase 4 — Multi-usuario + Clases
- Unificar CourtFinder + BuscarClases
- Abrir acceso a más usuarios
- Form para credenciales de booking

---

## Arquitectura

```
book-better-bot/court_monitor/
├── __init__.py
├── __main__.py              # python -m court_monitor --days 7
├── models.py                # CourtSlot, Venue dataclasses
├── config.py                # 13 venues con coords, slugs, precios
├── aggregator.py            # Orquesta scrapers en paralelo (ThreadPool)
├── generate_json.py         # CLI entry point → data/court_availability.json
└── scrapers/
    ├── __init__.py
    ├── better.py            # API autenticada (times + slots endpoints)
    ├── clubspark.py         # API pública GetVenueSessions (Category 0 = libre)
    └── parks.py             # Flow API con referrer correcto

ppc-final/src/components/
└── CourtFinder.tsx          # Componente completo (mapa + filtros + cards + alertas)

.github/workflows/
└── court-monitor.yml        # Cada 6h, genera JSON, commit automático
```

---

## Venues configurados (13)

| Venue | Plataforma | Courts | Precio/h | Postcode | Coords |
|-------|-----------|--------|----------|----------|--------|
| Highbury Fields | Better | 11 | ~£9.60 | N5 1AR | 51.552, -0.098 |
| Rosemary Gardens | Better | 2 | ~£9.60 | N1 2DT | 51.540, -0.095 |
| Kennington Park | ClubSpark | 5 | £8 | SE11 4BE | 51.480, -0.106 |
| Archbishops Park | ClubSpark | 2 | £8 | SE1 7LE | 51.498, -0.115 |
| Burgess Park | ClubSpark | 7 | £3.80-5.20 | SE5 0RJ | 51.483, -0.082 |
| Vauxhall Park | ClubSpark | 2 | £8 | SW8 1LA | 51.478, -0.123 |
| Larkhall Park | ClubSpark | 2 | £8 | SW8 1QQ | 51.474, -0.127 |
| Battersea Park | ClubSpark | 16 | £11.60 | SW11 4NJ | 51.478, -0.157 |
| Clapham Common | ClubSpark | 6 | £12.50 | SW4 9DE | 51.457, -0.148 |
| Parliament Hill | ClubSpark | 12 | gratis? | NW5 1QR | 51.556, -0.150 |
| Finsbury Park | ClubSpark | 8 | £4-7 | N4 2NQ | 51.566, -0.103 |
| Queens Park | ClubSpark | 6 | £11.60 | NW6 6SG | 51.534, -0.204 |
| Hyde Park | Flow | 6 | ~£12 | W2 2UH | 51.507, -0.170 |

---

## Endpoints por plataforma

### Better (requiere JWT auth)
```
GET /api/activities/venue/{slug}/activity/{activity}/times?date=YYYY-MM-DD
GET /api/activities/venue/{slug}/activity/{activity}/slots?date=...&start_time=HH:MM&end_time=HH:MM
```

### ClubSpark (público, sin auth)
```
GET /v0/VenueBooking/{slug}/GetVenueSessions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
→ Resources[].Days[].Sessions[] donde Category==0 es LIBRE
```

### Flow/Parks (público, necesita Referer correcto)
```
GET https://flow.onl/api/activities/venue/{slug}/activity/tennis/v2/timetable?date=YYYY-MM-DD
Headers: Referer: https://sportsandleisureroyalparks.bookings.flow.onl/location/hyde-park-courts/tennis/
```

---

## Tabla Supabase: court_watchlist

```sql
CREATE TABLE court_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  venue_slug text NOT NULL,
  venue_name text NOT NULL,
  target_date date NOT NULL,
  time_block text NOT NULL DEFAULT 'all', -- 'HH:00' para hora específica, o 'morning'/'afternoon'/'evening'/'all'
  platform text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## Cómo agregar un nuevo venue

1. Verificar que el endpoint funciona:
   - ClubSpark: `GET /v0/VenueBooking/{slug}/GetVenueSessions?startDate=...&endDate=...`
   - Better: necesita activity_slug del venue
   - Flow: necesita el slug correcto + referrer

2. Agregar en `court_monitor/config.py`:
```python
Venue(
    name="Nombre",
    slug="slug-del-endpoint",
    platform="clubspark",  # o "better" o "parks"
    postcode="XX0 0XX",
    lat=51.xxx,
    lng=-0.xxx,
    courts=N,
    booking_url="https://...",
    url_segment="slug",  # para ClubSpark
)
```

3. Correr `python -m court_monitor --days 1` para verificar.

---

## Comandos útiles

```bash
# Generar JSON localmente (7 días)
cd book-better-bot
python -m court_monitor --days 7

# Solo ClubSpark (sin auth de Better)
python -m court_monitor --days 3 --no-better

# Un día específico
python -m court_monitor --date 2026-05-12

# Con verbose logging
python -m court_monitor --days 3 -v
```

---

## Pendientes / Ideas futuras

- [ ] Backend de alertas (comparar JSON vs watchlist → push)
- [ ] Reducir frecuencia Action a 1h o 30min
- [ ] Agregar más venues (Southwark Park, Geraldine Mary, etc.)
- [ ] Buscador por código postal (geocoding → mover mapa)
- [ ] Historial de disponibilidad (detectar patrones)
- [ ] Booking automático (Fase 3)
- [ ] Integrar con BuscarClases en una sola vista
- [ ] Dark mode
