# PlayCoach — Decisiones y Contexto

## Resumen del proyecto

**PlayCoach** es una plataforma web independiente que conecta profesores de tenis con alumnos. Los coaches crean perfiles, gestionan su calendario, configuran precios, y reciben reservas. Los alumnos descubren coaches por ubicación, reservan clases, y pagan a través de la plataforma.

- **Working name**: PlayCoach (puede cambiar en el futuro)
- **Mercado inicial**: Londres, UK
- **Expansión futura**: Chile, otros países
- **Deporte inicial**: Tenis (luego pádel, pickleball, otros deportes de raqueta)

---

## Decisiones tomadas (15 mayo 2026)

### Infraestructura
| Decisión | Elección | Motivo |
|----------|----------|--------|
| Proyecto | Completamente nuevo e independiente | No mezclar con PPC (cuentas, datos, dominio distintos) |
| Base de datos | Supabase nuevo (proyecto separado) | Aislamiento de datos, RLS independiente |
| Hosting | Vercel (nuevo proyecto) | Mismo stack conocido, free tier generoso |
| Dominio | `playcoach.vercel.app` inicialmente | Gratis. Dominio custom cuando haya tracción |
| Repo | Nuevo repo en GitHub | Código independiente |

### Stack técnico
| Decisión | Elección | Alternativa descartada | Motivo |
|----------|----------|----------------------|--------|
| Frontend | React 19 + TypeScript + Vite 7 | Next.js, Remix | Conocimiento previo, velocidad de desarrollo |
| Estilos | Tailwind CSS 4 | CSS Modules, Styled Components | Consistencia con PPC, productividad |
| Routing | React Router v7 (hash mode) | State-based (como PPC) | URLs compartibles desde día 1, Coach_Page necesita slug |
| State | Zustand | Redux, Jotai, useState | Ligero, sin boilerplate, escalable |
| Email | Resend | Gmail SMTP, SendGrid | API moderna, React Email templates, free tier |
| Maps | Leaflet + OSM | Google Maps, Mapbox | Gratis, sin API key, suficiente para MVP |
| Geocoding | postcodes.io (UK) | Google Geocoding, Nominatim | Gratis, rápido, específico para UK |
| Auth | Supabase Auth (email + Google OAuth) | Auth0, Clerk | Integrado con Supabase, gratis |

### Producto
| Decisión | Elección | Motivo |
|----------|----------|--------|
| Modelo de negocio | Suscripción mensual para coaches | Ingreso recurrente predecible. No comisión por booking. |
| Free trial | 30 días con todas las features | Reducir fricción de onboarding |
| Booking modes | Auto-accept + Manual approval | Flexibilidad para el coach |
| Pagos (MVP) | Coach configura su método (transferencia, link) | No requiere Stripe. Alumno paga directo al coach. |
| Pagos (futuro) | Stripe Connect | Pagos con tarjeta, split automático |
| Cancelación | Configurable por coach (default 24h) | Más flexible que hardcodear |
| Class Packs | Hasta 20 packs activos, 2-50 clases | Incentiva fidelización |

### Fases de desarrollo
| Fase | Scope | Duración estimada |
|------|-------|-------------------|
| 1 | Coach profile + calendar + booking directo (via link) | 4 semanas |
| 2 | Marketplace/búsqueda + reviews + notificaciones + packs | 4 semanas |
| 3 | Stripe + multi-país + analytics | 4 semanas |

---

## Competencia analizada

### Modelo a seguir: TeachMe.To
- **URL**: https://teachme.to
- **Qué hace bien**: Booking instantáneo, perfiles de coach con availability, pricing transparente, reviews, mapa, filtros
- **Funding**: $2M seed (2023, TechCrunch)
- **Métricas**: 100+ lecciones/día, 61,312 lecciones en 2024, coaches ganan hasta $100/h
- **Limitación**: Solo US/Canadá. No tiene presencia en UK ni LATAM.
- **Referencia UI**: Mapa con coaches, filtros laterales, availability en perfil, gift cards, "get free session", "apply to teach"

### Competidores directos
| Plataforma | URL | Modelo | Debilidad |
|---|---|---|---|
| **Superprof** | superprof.co.uk / superprof.cl | Directorio. £29 para desbloquear contacto. Sin agenda. | Sin booking, sin calendario, flujo horrible |
| **Playtomic Academy** | playtomic.com/academy | Módulo para clubs. Cursos + clases privadas. | Solo para clubs, no coaches independientes |
| **RacketCoach.app** | racketcoach.app | Scheduling para coaches. £19.99/mes + 50p/booking. | Sin marketplace, coach trae sus propios alumnos |
| **CourtReserve** | courtreserve.com | SaaS para clubs ($100-500/mes). | Caro, orientado a clubs con infraestructura |
| **Bookedin** | bookedin.com | Scheduling genérico ($30-50/mes). | No específico de tenis, sin marketplace |

### Mercado Chile
- **No existe nada equivalente** para coaching de tenis
- Superprof.cl existe pero mismo modelo de directorio sin agenda
- Playtomic tiene presencia mínima (solo canchas, no coaching)
- Clubs privados operan por WhatsApp/teléfono
- Coaches freelance usan Instagram/WhatsApp
- **Oportunidad clara**: mercado completamente abierto

### Nuestra ventaja competitiva
1. **Coach independiente + marketplace** — TeachMe.To lo hace pero solo en US
2. **Clases grupales con booking real** — Superprof no tiene, Bookedin no tiene marketplace
3. **Alertas inteligentes** — "Hay clase cerca en 2h con descuento" — nadie lo hace bien
4. **Multi-mercado UK + Chile** — TeachMe.To no está en ninguno
5. **Precio bajo** — CourtReserve cobra $100+/mes, nosotros £5-10/mes o free trial largo
6. **Integración con court finder** — Valor agregado único (disponibilidad de canchas junto a clases)

---

## Nombre

### Working name: PlayCoach
- Corto, memorable, combina juego + coaching
- Funciona para cualquier deporte
- Se puede cambiar en el futuro sin impacto técnico significativo

### Alternativas consideradas
- CoachMe → `coach.me` ya existe (habit coaching platform)
- CourtClass → No muy "catchy"
- RallyUp → Bueno pero menos claro
- TrainPlay → Dinámico pero no dice "coach"
- ProCourt, ProSkills, ProRackets → Demasiado genéricos

### Dominios a evaluar cuando haya tracción
- `playcoach.app`
- `playcoach.io`
- `getplaycoach.com`

---

## Ideas futuras (post-MVP)

### Producto
- Rating/reviews con flujo completo (post-clase, verificado)
- Waitlist para clases llenas
- Coach verification/badges (LTA Level 3, PTR, etc.)
- Gift cards / "regala una clase"
- Referral program ("invita un amigo, clase gratis")
- Descuentos por horario (off-peak pricing)
- Integración con court monitor (disponibilidad de canchas junto a clases)

### Monetización adicional
- Publicidad de marcas de tenis (raquetas, cuerdas, ropa)
- Descuentos por volumen de clases
- Partnerships con tiendas (cambio de cuerdas, etc.)
- Featured coach (coach paga por aparecer primero en búsqueda)

### Expansión
- Pádel, Pickleball, Squash, Badminton
- Otros países: España, México, Argentina
- App nativa (React Native o Flutter) — solo si hay tracción significativa

---

## Qué necesita crear el usuario manualmente

1. **Proyecto Supabase** — Crear en supabase.com (free tier, región EU West/London)
2. **Proyecto Vercel** — Crear y conectar con el repo de GitHub
3. **Repo GitHub** — `jifones/playcoach` (o el nombre que elija)
4. **VAPID keys** — Generar par de claves para Web Push
5. **Cuenta Resend** — Crear en resend.com (free tier, 100 emails/día)
6. **Google OAuth** — Configurar en Google Cloud Console + Supabase Auth

---

## Última actualización
16 mayo 2026

---

## Estado actual del proyecto

**Fase 1 (MVP)**: ✅ Completada y deployada en https://playcoach.vercel.app
**Fase 2 (Marketplace)**: 🚧 En progreso — Search page implementada, faltan reviews, class packs UI, email

### Lo que funciona hoy:
- ✅ Registro (email + Google OAuth)
- ✅ Coach dashboard (profile, locations, payments, calendar, classes, bookings)
- ✅ Availability grid (setup rápido de horarios semanales)
- ✅ Coach page pública compartible (`/coach/slug`)
- ✅ Student booking flow (book → payment info modal)
- ✅ My Bookings (ver, cancelar)
- ✅ Coach booking management (approve/reject/cancel + realtime)
- ✅ Search page (por postcode, área, nombre)
- ✅ Push notifications (infra lista, banner opt-in)
- ✅ Cron jobs (expire bookings diario, class reminders diario)
- ✅ PWA instalable
- ✅ Onboarding post-Google OAuth (selección de rol)
- ✅ Publish/Unpublish toggle en dashboard

### Próximos pasos (por prioridad):

**Polish / UX (inmediato):**
1. Revisar flujo completo coach→student→booking en producción
2. Mejorar responsive en mobile (probar en teléfono real)
3. Agregar "Add coach role" para cuentas de estudiante existentes
4. Mejorar Availability Grid (más intuitivo, preview de horas)

**Fase 2 — Features pendientes:**
5. Reviews/ratings post-clase (alumno califica después de la clase)
6. Class packs UI (coach crea packs, alumno compra y usa créditos)
7. Email notifications con Resend (confirmación booking, reminders)
8. Filtros en Search (precio, tipo de clase, disponibilidad)
9. Locations mejorado (lista de venues conocidos + mapa)

**Fase 3 — Monetización:**
10. Stripe Connect (pagos escrow, payouts al coach)
11. Suscripción para coaches (planes mensual/trimestral/anual)
12. Multi-país (Chile: moneda CLP, timezone, idioma)
13. Landing pages por zona (SEO)

### Deploy
```bash
cd c:\Users\jifon\projects\playcoach
npx vercel --prod
```

---

## Deployment

- **URL producción**: https://playcoach.vercel.app
- **Deploy method**: `npx vercel --prod` desde terminal (no auto-deploy via GitHub por limitación de Vercel Hobby + org)
- **Vercel team**: PintaPostChampionship (mismo team que PPC, proyecto separado)
- **Repo**: `jifones/playcoach` (cuenta personal GitHub, no transferido a org)
- **Supabase MCP**: configurado como `supabase-playcoach` en `~/.kiro/settings/mcp.json` con project_ref `nyskojznpmvxrsubfnsl`

---

## Known Issues / Polish pendiente (para próxima sesión)

1. ~~**Register flow**: Si el usuario clickea "I'm a Coach" desde la landing, debería saltar el paso de selección de rol~~ ✅ Arreglado
2. **Google OAuth**: No configurado aún (requiere Google Cloud Console setup)
3. **Cron jobs**: Limitados a 1x/día en Vercel Hobby (expire-bookings a las 6am, reminders a las 8am UTC)
4. **PWA icons**: Placeholder SVG — necesita diseño real (192x192, 512x512 PNG)
5. ~~**Coach publish toggle**: No hay botón en la UI para publicar/despublicar~~ ✅ Arreglado
6. **Dual role**: No hay UI para agregar rol de coach a una cuenta de estudiante existente
7. **Availability Grid**: Funcional pero podría ser más intuitivo (drag horizontal, preview de horas)
8. **Coach Page**: No muestra payment details después de booking (sidebar solo muestra info genérica)
9. **Email notifications**: Resend no configurado aún (solo push por ahora)

---

## Ideas y mejoras para próximas sesiones

### Registro más profesional (inspirado en TeachMe)
- Registro con Google OAuth (prioritario — reduce fricción)
- Onboarding guiado post-registro: "Complete your profile" con progress bar
- Verificación de email antes de publicar página
- Foto de perfil obligatoria para coaches (o placeholder profesional)
- Testimonial/social proof en la página de registro ("Join 50+ coaches in London")

### Locations mejorado
- Lista desplegable de locations conocidas (venues que ya existen en la DB)
- Mapa interactivo para seleccionar ubicación (Leaflet click-to-select)
- Autocompletado de dirección/postcode
- Si el venue no existe, formulario para agregar nuevo (como está ahora)
- Los venues agregados por coaches alimentan el buscador de canchas/clases
- Cada venue puede tener: nombre, dirección, coordenadas, fotos, amenities (luces, indoor/outdoor, superficie)

### Modelo de negocio / Pricing (para definir)
- **Opción A**: Suscripción fija mensual para coaches (£5-15/mes)
- **Opción B**: Comisión por clase (£0.50 por booking confirmado)
- **Opción C**: Freemium (gratis hasta X bookings/mes, luego pago)
- Descuento si el alumno paga en efectivo (coach ahorra comisión de tarjeta)
- Stripe Connect para pagos con tarjeta (Stripe cobra ~2.9% + 20p)
- Opción de pago anticipado vs post-clase (ya implementado como config)
- Class packs con descuento por volumen (ya en schema, falta UI)

### Pagos — Modelo escrow (evaluación Fase 3+)

**Referencia: TeachMe.To cobra ~20% comisión. Alumno paga upfront, coach cobra después de la clase vía payout en 24-48h.**

**Modelo escrow para PlayCoach:**
1. Alumno paga con tarjeta al momento del booking → dinero queda retenido en nuestra cuenta Stripe
2. Clase se completa → coach confirma en la app (o se auto-confirma después de X horas)
3. PlayCoach libera el pago al coach (menos comisión)
4. Si hay disputa → PlayCoach media y decide si reembolsar al alumno

**Frecuencia de pago al coach (configurable por el coach):**
- Diario: cada día se transfiere lo acumulado del día anterior
- Semanal: todos los lunes se paga la semana anterior
- Mensual: el 1 de cada mes se paga el mes anterior

**Ventajas del escrow:**
- Seguridad para el alumno (reembolso si el coach no aparece)
- Seguridad para el coach (pago garantizado si la clase se dio)
- Genera confianza en la plataforma
- Permite cobrar comisión de forma transparente
- Permite ofrecer reembolsos automáticos por cancelación

**Comisión sugerida:**
- 10-15% (más bajo que TeachMe 20% para ser competitivos)
- O flat fee: £1-2 por booking (más atractivo para coaches con precios altos)
- Primeros 3 meses: 0% comisión (incentivo para onboarding)

**Implementación técnica:**
- Stripe Connect (Standard o Express) — cada coach tiene su cuenta Stripe vinculada
- Stripe maneja KYC, verificación de identidad, y compliance
- Payouts automáticos según la frecuencia elegida por el coach
- Dashboard de earnings para el coach (total ganado, pendiente, próximo payout)

**Decisión**: Empezar con pago directo (MVP actual). Implementar escrow con Stripe Connect cuando haya 20+ coaches activos y volumen de bookings justifique el desarrollo.

### Expansión Chile
- Investigar canchas y profesores en Santiago (Las Condes, Providencia, Ñuñoa)
- Superprof.cl como fuente de datos (scraping de profesores para contactar)
- Adaptar moneda (CLP), timezone (America/Santiago), idioma (español)
- Buscar si hay plataformas locales de reserva de canchas
- Contactar profesores directamente (LinkedIn, Instagram, WhatsApp)
- Posible partnership con clubes/academias

### Dashboard del jugador (Student Dashboard)
- Al hacer login como jugador, debería llegar a un dashboard con opciones claras
- Opciones principales: Tomar Clase, Buscar Cancha, Marcador de Tenis, Mis Bookings
- Left navbar con accesos rápidos a las funciones principales
- Diseño simplificado con las cosas importantes visibles de entrada
- Búsqueda por cancha: mostrar venues y al clickear ver coaches disponibles ahí
- Filtros: nombre de cancha, nombre de profesor, precios, disponibilidad
- Opción "Consultar disponibilidad" si el coach no muestra horas (porque no tiene cancha reservada)

### Ratings y evaluaciones
- Rating bidireccional: alumno califica al coach, coach califica al alumno
- Coach pone rating de nivel al alumno (1-5): 1=principiante, 5=avanzado
- El rating de nivel lo pone el coach 1 sola vez (no puede cambiarlo después)
- Después del rating inicial, el nivel del alumno depende de sus partidos o evaluación periódica
- Con los ratings se puede crear un sistema de matchmaking para partidos amistosos
- Los alumnos pueden ir mejorando su rating a través de juegos

### Comunicación coach-alumno
- Sección de comentarios o mensajes
- Chat o mensajería cuando se agenda una clase (para coordinar detalles)
- Los coaches pueden describir dónde hacen clases (además de la bio)
- Posible: notificación al alumno cuando el coach publica nueva disponibilidad

### Features inspiradas en TeachMe.To
- **Gift cards**: "Regala una clase" — comprar crédito para otro usuario
- **Get free session**: Referral program (invita amigo → clase gratis para ambos)
- **Coach verification badges**: LTA Level 3, PTR, DBS checked, etc.
- **Video intro**: Coach sube video corto de presentación (30-60s)
- **Availability calendar público**: Vista semanal en la Coach_Page (como Calendly)
- **Instant booking vs Request**: Ya implementado, pero mejorar la UX visual
- **Reviews con fotos**: Alumno puede subir foto de la clase
- **Coach response time**: Mostrar "Usually responds within 2 hours"
- **Favourite coaches**: Alumno puede guardar coaches favoritos
- **Similar coaches**: "Students also booked with..." en la Coach_Page

### Buscador de canchas/clases (integración futura)
- Unificar venues de coaches con el court_monitor existente (book-better-bot)
- Mostrar disponibilidad de canchas junto a clases del coach
- "Book court + lesson" en un solo flujo
- Alertas: "Hay clases disponibles cerca de ti" / "Descuento en clase a las X"

### Marketing y growth
- SEO: Coach_Page indexable por Google (meta tags, structured data)
- Landing pages por zona: "/london/islington", "/london/kennington"
- Blog/content: "How to find a tennis coach in London"
- Partnerships con tiendas de tenis (descuentos en cuerdas, raquetas)
- Publicidad segmentada en la plataforma (featured coaches)

