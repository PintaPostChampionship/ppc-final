# Buscar Clases — Vista de sesiones de tenis en Londres

## Qué es

Vista privada en ppctennis.vercel.app que muestra sesiones de tenis disponibles en Londres (clases grupales tipo drill y clases 1×1), agrupadas por día en un weekly board con filtros. Solo visible para el profile ID autorizado.

---

## Arquitectura general

```
Flow / Better / ClubSpark
        ↓
GitHub Action (repo: jifones/booking_ppc, cada 2h)
        ↓
data/tennis_sessions.json  (repo privado)
        ↓
BuscarClases.tsx  (fetch con PAT al abrir la vista)
        ↓
Weekly board en la web
```

La web **no tiene base de datos propia** para las sesiones. Todo viene del JSON generado por el scraper. Cada vez que el usuario abre la vista "Buscar clases" se hace un fetch fresco del JSON, por lo que los datos son siempre los del último run del Action (ciclo de 2 horas).

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/components/BuscarClases.tsx` | Componente completo: fetch, filtros, weekly board, tarjetas |
| `src/App.tsx` | Integración: estado `showBuscarClases`, render condicional, botones |
| `.env.local` | Variables de entorno locales (no subir a GitHub) |

---

## Acceso restringido

El botón "🎾 Buscar clases" y la vista solo se muestran si el usuario logueado tiene el profile ID autorizado:

```typescript
// src/App.tsx — línea ~7 (cerca del import de BuscarClases)
const BUSCAR_CLASES_ALLOWED_ID = "fb045715-86c6-48fc-88dc-c784fa5ed2bc";
```

Para dar acceso a otro usuario, añadir su UUID de Supabase aquí (o convertirlo en array si son varios).

La condición en los botones y en el render:
```typescript
{currentUser?.id === BUSCAR_CLASES_ALLOWED_ID && (
  <button onClick={() => setShowBuscarClases(true)}>🎾 Buscar clases</button>
)}
```

---

## Variables de entorno

### `.env.local` (local)
```
VITE_GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### Vercel (producción)
Settings → Environment Variables → `VITE_GITHUB_TOKEN`

El token es un **GitHub Personal Access Token (classic)** con scope `repo`, creado desde la cuenta `jifones` en github.com/settings/tokens. Permite leer el repo privado `booking_ppc`.

> ⚠️ El token queda expuesto en el bundle del frontend. El repo `booking_ppc` solo contiene datos de sesiones de tenis, sin información sensible. Si en el futuro se quiere mayor seguridad, crear un endpoint serverless en Vercel que actúe de proxy (el token quedaría solo en el servidor).

---

## Fetch del JSON

```typescript
// URL — API de GitHub (no raw.githubusercontent.com, que no acepta PAT en repos privados)
const JSON_URL =
  "https://api.github.com/repos/jifones/booking_ppc/contents/data/tennis_sessions.json";

// Headers necesarios
headers["Accept"] = "application/vnd.github.v3.raw";   // devuelve el contenido directo
headers["Authorization"] = `Bearer ${token}`;           // autenticación PAT
```

`raw.githubusercontent.com` **no funciona** con PAT para repos privados — siempre usar la API de GitHub con estos headers.

---

## Estructura del JSON (`tennis_sessions.json`)

```json
{
  "generated_at": "2026-04-16T...",
  "total_sessions": 30,
  "sessions": [
    {
      "source": "flow" | "better" | "clubspark",
      "title": "Adult Intermediate",
      "start_datetime": "2026-04-22T19:00:00+01:00",
      "duration_minutes": 60,
      "session_type": "drill" | "1x1",
      "level": "beginner" | "intermediate" | "advanced",
      "level_ntrp": 3.5,
      "price_gbp": 15.0,
      "availability": 5,
      "capacity": 7,
      "venue_name": "Clapham Common",
      "venue_postcode": "SW4 9AN",
      "booking_link": "https://..."
    }
  ]
}
```

---

## Plataformas scrapeadas

| Plataforma | Slug en JSON | Web |
|------------|-------------|-----|
| Flow Tennis | `flow` | flowtennis.co.uk |
| Better (GLL) | `better` | better.org.uk |
| ClubSpark (LTA) | `clubspark` | clubspark.lta.org.uk |

Para **agregar una nueva plataforma**, el cambio es en el scraper del repo `booking_ppc` (GitHub Action). En la web solo hay que añadir el nuevo slug a las constantes en `BuscarClases.tsx`:

```typescript
// Añadir en SOURCE_LABELS, SOURCE_COLORS, y el array de filtros
const SOURCE_LABELS = { ..., nuevaplataforma: "Nombre visible" };
const SOURCE_COLORS = { ..., nuevaplataforma: "bg-xxx-100 text-xxx-800" };
// En el JSX del filtro de plataforma, añadir "nuevaplataforma" al array
```

---

## Filtros disponibles

- **Tipo**: Todos / Drill / 1×1
- **Plataforma**: Todas / Flow / Better / ClubSpark
- **Nivel**: Todos + niveles dinámicos (se generan desde los datos del JSON)

Los niveles son dinámicos — si el scraper añade un nivel nuevo (ej: `"elite"`), aparece automáticamente en el filtro sin cambios en el código.

---

## Cómo añadir un nuevo venue o filtro por ubicación

Actualmente no hay filtro por ubicación/venue. Para añadirlo:

1. Verificar que el JSON incluye `venue_name` y `venue_postcode` en cada sesión (ya los tiene)
2. En `BuscarClases.tsx`, añadir estado `filterVenue` similar a `filterLevel`
3. Generar la lista dinámica de venues únicos igual que se hace con `availableLevels`
4. Añadir el bloque de botones de filtro en el panel de filtros

El venue ya se muestra en cada tarjeta (`📍 venue_name postcode`).

---

## Navegación en App.tsx

El patrón es idéntico al de `FindTennisCourt` (vista "Encontrar Cancha"):

```typescript
// Estado
const [showBuscarClases, setShowBuscarClases] = useState(false);

// Render condicional (antes del bloque if (!selectedTournament))
if (showBuscarClases && currentUser?.id === BUSCAR_CLASES_ALLOWED_ID) {
  return <BuscarClases onBack={() => setShowBuscarClases(false)} />;
}

// Reset en logout
setShowBuscarClases(false);
```

El botón aparece en **dos lugares** de App.tsx (ambos junto al botón "Encontrar Cancha"):
1. Vista principal de torneos (`!selectedTournament`)
2. Vista de detalle de torneo (sección "Find Tennis Courts")
