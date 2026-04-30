---
inclusion: manual
---

# Garmin Connect IQ — Marcador PPC para reloj

## Idea

Crear una app para relojes Garmin que funcione como marcador de tenis del PPC, sincronizada con el Live Scoreboard de la web. El jugador lleva el marcador desde la muñeca durante el partido, y los espectadores lo siguen en tiempo real en ppctennis.vercel.app.

---

## Plataforma: Garmin Connect IQ

- **Lenguaje**: Monkey C (similar a Java/C, tipado, orientado a objetos)
- **IDE**: VS Code con extensión oficial Monkey C
- **SDK**: Connect IQ SDK 8.2.3 (última versión estable)
- **Simulador**: Incluido en el SDK, emula distintos modelos de reloj
- **Distribución**: Connect IQ Store (gratuito para publicar)
- **Docs**: https://developer.garmin.com/connect-iq/sdk

### Capacidades relevantes

| Feature | API | Notas |
|---------|-----|-------|
| HTTP requests | `Toybox.Communications.makeWebRequest` | GET/POST a endpoints externos |
| Botones físicos | `Toybox.WatchUi.InputDelegate` | UP/DOWN/SELECT/BACK/MENU |
| Pantalla táctil | `Toybox.WatchUi.View.onUpdate` | Solo en modelos con touch |
| Almacenamiento local | `Toybox.Application.Storage` | Persistir estado entre sesiones |
| Vibración | `Toybox.Attention.vibrate` | Feedback háptico al registrar punto |
| Timer | `Toybox.Timer` | Para polling o countdown |
| Bluetooth | Via teléfono companion | Las web requests pasan por el teléfono |

### Limitaciones importantes

- **Sin WebSocket/Realtime**: No hay soporte nativo para WebSocket. La comunicación es via HTTP polling (cada N segundos) o push desde companion app.
- **Memoria limitada**: ~128KB en la mayoría de modelos. La app debe ser ligera.
- **Pantalla pequeña**: ~240x240 px en modelos redondos, ~260x260 en cuadrados.
- **Requests via teléfono**: Las llamadas HTTP pasan por el teléfono conectado via Bluetooth. Sin teléfono cerca, no hay conectividad.
- **Rate limiting**: Garmin recomienda no hacer más de 1 request cada 5 segundos.

---

## Arquitectura propuesta

```
┌─────────────┐     HTTP POST      ┌──────────────────┐
│  Garmin      │ ──────────────────→│  Vercel Function  │
│  Watch App   │     (cada punto)   │  /api/live-score  │
│  (Monkey C)  │ ←──────────────────│                   │
│              │     HTTP GET       └────────┬──────────┘
│  Botones:    │     (polling 5s)            │
│  UP = P1     │                             │ Supabase
│  DOWN = P2   │                             │ UPDATE
│  BACK = Undo │                             ↓
└─────────────┘                    ┌──────────────────┐
                                   │  live_score_state │
                                   │  (Supabase)       │
                                   └──────────────────┘
                                            ↑
                                   Realtime subscription
                                            │
                                   ┌──────────────────┐
                                   │  ppctennis.vercel │
                                   │  (web viewers)    │
                                   └──────────────────┘
```

### Flujo

1. El jugador abre la app en el Garmin y selecciona un partido activo
2. La app muestra el marcador actual (fetch inicial via HTTP GET)
3. El jugador presiona UP (punto P1) o DOWN (punto P2)
4. La app calcula el nuevo estado localmente (misma lógica de `liveScoreUtils.ts` portada a Monkey C)
5. La app envía el nuevo estado via HTTP POST a una Vercel Function
6. La Vercel Function actualiza `live_score_state` en Supabase
7. Los viewers en la web reciben el update via Supabase Realtime
8. La app hace polling cada 5s para sincronizar (por si otro editor también está actualizando)

### Alternativa: Companion App

En vez de HTTP directo desde el reloj, se podría crear una companion app (Android/iOS) que:
- Recibe los puntos del reloj via Bluetooth
- Se conecta a Supabase Realtime directamente
- Sincroniza en ambas direcciones

Esto es más complejo pero elimina el polling y reduce latencia.

---

## Vercel Function necesaria: `/api/live-score`

Endpoint nuevo que actúa como proxy entre el reloj y Supabase:

```
POST /api/live-score
Body: { match_id, action: "add_point", player: 1|2, auth_token }
→ Calcula nuevo estado, actualiza live_score_state

GET /api/live-score?match_id=xxx
→ Devuelve estado actual del partido

POST /api/live-score
Body: { match_id, action: "undo", auth_token }
→ Revierte al estado anterior
```

El `auth_token` sería un token simple (UUID del jugador) para validar que quien envía el punto es un editor autorizado.

---

## Repos de referencia (open source)

| Repo | Descripción |
|------|-------------|
| [grimpy/connect-iq-score-keeper](https://github.com/grimpy/connect-iq-score-keeper) | Score keeper de tenis para Garmin Instinct 2 (MIT license). Código base para la lógica de UI y botones. |
| [garmin/connectiq-apps](https://github.com/garmin/connectiq-apps) | Colección oficial de apps de ejemplo de Garmin. |
| [douglasr/connectiq-samples](https://github.com/douglasr/connectiq-samples) | Samples de Connect IQ incluyendo HTTP requests. |
| [Darthpwner/Tennis-Score-Keeper-WatchOS](https://github.com/Darthpwner/Tennis-Score-Keeper-WatchOS) | Tennis score keeper para Apple Watch (Swift). Referencia de UX. |

### MCP Server para desarrollo

Existe un [MCP server de documentación Garmin](https://github.com/ztuskes/garmin-documentation-mcp-server) que da acceso offline a toda la documentación del SDK 8.2.3. Se puede instalar en Kiro para tener asistencia completa al desarrollar:

```json
{
  "mcpServers": {
    "garmin-documentation": {
      "command": "node",
      "args": ["/path/to/garmin-documentation-mcp-server/dist/index.js"]
    }
  }
}
```

---

## Apps existentes en Connect IQ Store

| App | Descripción | Limitación vs PPC |
|-----|-------------|-------------------|
| Tennis Tracker | Score + stats (serve %, etc.) | Sin sincronización web |
| Paddle Scoreboard | Tennis/padel, configurable | Sin sincronización web |
| Sports+ | Multi-deporte con score | Genérico, sin tenis específico |

Ninguna app existente se sincroniza con un backend externo. La app PPC sería única en ese aspecto.

---

## Alternativas a Garmin

| Plataforma | Lenguaje | Pros | Contras |
|------------|----------|------|---------|
| **Garmin Connect IQ** | Monkey C | Botones físicos ideales para tenis, batería larga, muchos modelos | Sin WebSocket, memoria limitada, lenguaje nicho |
| **Apple Watch (watchOS)** | Swift/SwiftUI | WebSocket nativo, pantalla grande, ecosystem Apple | Solo usuarios Apple, batería corta, requiere Mac para desarrollo |
| **Wear OS (Google)** | Kotlin | WebSocket, pantalla táctil, ecosystem Android | Batería corta, fragmentación de dispositivos |
| **Web App (PWA)** | TypeScript | Sin desarrollo nativo, funciona en cualquier dispositivo | Necesita teléfono en la cancha, no tan cómodo como reloj |

### Recomendación

**Empezar con Garmin** si los jugadores del PPC usan Garmin (que es común en gente deportista en Londres). La ventaja de los botones físicos es enorme para tenis: puedes registrar un punto sin mirar la pantalla, solo presionando UP o DOWN.

Si no todos tienen Garmin, la **PWA en el teléfono** es el fallback universal — ya la tienes con el Live Scoreboard actual.

---

## Fases de implementación

### Fase 1: App offline (sin sync)
- Marcador local en el reloj
- Lógica de puntuación portada de `liveScoreUtils.ts` a Monkey C
- Botones: UP=P1, DOWN=P2, BACK=Undo, MENU=Config
- Formatos: Standard, SuperTiebreak
- Vibración al ganar game/set/match

### Fase 2: Sync con PPC
- Vercel Function `/api/live-score` como proxy
- HTTP POST al registrar cada punto
- HTTP GET polling cada 5s para sincronizar
- Selección de partido activo desde el reloj

### Fase 3: Companion app (opcional)
- App Android/iOS que actúa como bridge
- Conexión Supabase Realtime directa
- Sincronización bidireccional sin polling

---

## Requisitos para empezar

1. **Garmin Connect IQ SDK** instalado (VS Code + extensión Monkey C)
2. **Cuenta de desarrollador Garmin** (gratuita): https://developer.garmin.com
3. **Reloj Garmin compatible** para testing real (o usar el simulador)
4. **Vercel Function** nueva para el endpoint `/api/live-score`
