---
inclusion: manual
---

# Contexto de Proyectos — Ecosistema Completo

Información compartida para todos los agentes. Describe los proyectos activos, su estado, y las prioridades del fundador.

---

## El Fundador

- Solo founder/developer basado en Londres
- Background técnico (puede construir cualquier cosa)
- Necesita ayuda decidiendo QUÉ construir y cómo CRECER
- Tiempo limitado — priorización es crítica
- Intereses: tenis, tecnología, automatización, productos digitales

---

## Proyectos Activos

### 1. PlayCoach (Producto comercial — PRIORIDAD)

**Qué es**: Marketplace de coaching de tenis en Londres. Conecta coaches con alumnos. Reserva clases al instante.

**URL**: playcoach.vercel.app (en desarrollo)

**Estado**: MVP funcional, necesita primeros usuarios reales (coaches y alumnos)

**Stack**: React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Zustand + React Router v7 (hash) + Supabase + Vercel

**Features construidas**:
- Landing page con propuesta de valor
- Registro/login (coach y student)
- Onboarding diferenciado por rol
- Búsqueda de coaches con mapa (Leaflet)
- Página pública de coach (slug único, ej: /coach/juan-perez)
- Dashboard de coach: clases, disponibilidad, calendario, bookings, pagos, packs, ubicaciones
- Dashboard de alumno: bookings, historial
- Sistema de reviews/ratings
- Class packs (descuentos por volumen)
- Push notifications
- Court finder

**Base de datos (Supabase)**:
- profiles (roles: student/coach)
- coach_profiles (slug, headline, bio, qualifications, booking_mode, payment config, subscription)
- coach_locations (venue, lat/lng, postcode)
- classes (individual, group_drill, group_tournament, group_social)
- class_occurrences (instancias específicas con fecha/hora)
- bookings (pending → confirmed → completed)
- class_packs + class_pack_credits
- reviews (1-5 stars + comment)
- push_subscriptions

**Modelo de negocio (por definir)**:
- Trial 30 días gratis para coaches
- Después: suscripción mensual o comisión por booking
- Alumnos: gratis siempre

**Competencia directa**:
- Tiebreak (app de tenis, tiene coaching pero no es su foco)
- SPIN (booking de canchas, no coaching)
- ClubSpark/LTA (infraestructura de clubs, no freelance coaches)
- CoachNow (US-focused, video analysis)
- PlayYourCourt (US-focused)
- Websites individuales de coaches (WordPress, Wix)

**Ventaja competitiva potencial**:
- Enfocado 100% en Londres (local-first)
- Booking instantáneo (vs. "contact me" de la mayoría)
- Gratis para empezar (vs. plataformas que cobran upfront)
- Página pública shareable (el coach la comparte en sus redes)

**Próximos pasos críticos**:
1. Conseguir 3-5 coaches reales que publiquen su perfil
2. SEO local ("tennis coach near me london", "tennis lessons [area]")
3. Validar si coaches quieren pagar por la plataforma
4. Integrar pagos reales (Stripe o similar)
5. Mejorar la landing page para conversión

---

### 2. PPC — Pinta Post Championship (Comunidad)

**Qué es**: Liga de tenis amateur entre amigos en Londres. Web para gestionar torneos, resultados, rankings.

**URL**: ppctennis.vercel.app (en producción, ~15 usuarios activos)

**Estado**: Producto maduro, en mantenimiento + features incrementales

**Stack**: React 19 + TypeScript + Vite 7 + Tailwind CSS 3.4 + Supabase + Vercel

**Features principales**:
- Torneos con divisiones (Cobre, Plata, Oro)
- Tabla de posiciones, resultados set por set
- Live Scoreboard (Supabase Realtime)
- Perfiles de jugadores con Player Cards
- Reserva automática de canchas (bot)
- Buscar clases de tenis (scraper)
- Push notifications
- PWA instalable

**No es comercial** — es un proyecto de comunidad para amigos. No necesita marketing ni monetización.

---

### 3. Book Better Bot (Automatización)

**Qué es**: Bot que reserva canchas de tenis automáticamente en Better (plataforma de booking de canchas en Londres).

**Repo**: jifones/booking_ppc (privado)

**Estado**: En producción, funciona diariamente via GitHub Actions

**Componentes**:
- Bot de reservas (Python): reserva canchas a las 22:00 exacto cuando se liberan
- Court Monitor: scrapea disponibilidad de 21 venues cada 2h, alerta si se libera un slot
- Tennis Dashboard: scrapea clases de tenis disponibles cada 2h

**No es comercial** — herramienta personal/grupo de amigos.

---

## Ideas en Exploración

### PlayCoach como plataforma más amplia
- Expandir a otros deportes (padel, squash, swimming)
- Expandir a otras ciudades UK (Manchester, Birmingham)
- Marketplace de canchas (no solo coaches)

### Automatización para coaches
- Auto-posting en redes sociales
- CRM simple para coaches (seguimiento de alumnos)
- Generación automática de contenido (tips, drills)

### Contenido / Media
- Blog de tenis en Londres (SEO play)
- Newsletter para tennis community
- Instagram/TikTok con tips de tenis

---

## Restricciones del Fundador

- **Tiempo**: ~10-15h/semana para side projects
- **Budget**: Bajo (< £100/mes para herramientas y ads)
- **Skills**: Full-stack dev, puede construir rápido
- **Debilidades**: Marketing, ventas, networking con coaches
- **Ubicación**: Londres, zona sur (Kennington/Oval)
- **Red**: Grupo de ~15 amigos que juegan tenis regularmente

---

## Decisiones Pendientes

1. ¿Cómo conseguir los primeros coaches para PlayCoach?
2. ¿Cobrar suscripción o comisión? ¿Cuánto?
3. ¿Invertir en ads o crecer orgánico primero?
4. ¿Enfocar en un nicho (ej: solo coaches freelance) o ser amplio?
5. ¿Priorizar features técnicas o go-to-market?
