# Court Finder — Tasks

## Fase 1: Monitor de disponibilidad + Mapa ✅

### Backend (repo: booking_ppc) ✅

- [x] 1. Crear `court_monitor/models.py` con dataclass `CourtSlot` y `Venue`
- [x] 2. Crear `court_monitor/config.py` con 13 venues, coordenadas, slugs
- [x] 3. Crear `court_monitor/scrapers/better.py` — API autenticada (times + slots)
- [x] 4. Crear `court_monitor/scrapers/clubspark.py` — API pública GetVenueSessions
- [x] 5. Crear `court_monitor/scrapers/parks.py` — Flow API con referrer correcto
- [x] 6. Crear `court_monitor/aggregator.py` — ThreadPool paralelo, dedup, sort
- [x] 7. Crear `court_monitor/generate_json.py` — CLI, genera JSON
- [x] 8. Crear GitHub Action `court-monitor.yml` — cada 6h
- [x] 9. Test: 2123 slots, 12 venues con datos reales

### Frontend (repo: ppc-final) ✅

- [x] 10. Crear `CourtFinder.tsx` — componente completo
- [x] 11. Mapa Leaflet con geolocation + markers + "Mi ubicación"
- [x] 12. Fetch de `court_availability.json` via GitHub API
- [x] 13. Filtros: fecha (pills), bloque horario (pills), plataforma (dropdown)
- [x] 14. Venue pills multi-select + buscador autocomplete
- [x] 15. Mapa controla lista (moveend → actualiza venues abajo)
- [x] 16. Venue cards colapsables con slots agrupados por hora
- [x] 17. Botón "Reservar" → link directo + "📍" → Google Maps
- [x] 18. Integrar en App.tsx (estado, navegación, acceso restringido)
- [x] 19. Responsive mobile (touch targets, botón siempre visible)
- [x] 20. Tabla `court_watchlist` en Supabase
- [x] 21. UI alertas: WatchPanel con grid de horas, multi-select, save batch

---

## Fase 2: Alertas de disponibilidad

- [x] 20. Tabla `court_watchlist` en Supabase ✅
- [x] 21. UI: "🔔 Crear alerta ▼" con panel de horas ✅
- [ ] 22. Backend: comparar JSON actual vs watchlist, detectar slots nuevos
- [ ] 23. Trigger: push notification via `/api/send-notification`
- [ ] 24. Notification payload: venue, hora, link directo de booking

---

## Fase 3: Booking automático

- [ ] 25. Reutilizar `LiveBetterClient` para booking desde la web
- [ ] 26. UI: formulario "Reservar automáticamente"
- [ ] 27. ClubSpark: generar link directo al checkout
- [ ] 28. Notificación con link de pago al completar

---

## Fase 4: Multi-usuario + Clases

- [ ] 29. Unificar CourtFinder + BuscarClases
- [ ] 30. Abrir acceso a más usuarios
- [ ] 31. Form para credenciales de booking
- [ ] 32. Agregar más venues según demanda
