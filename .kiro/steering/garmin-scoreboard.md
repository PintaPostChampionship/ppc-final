---
inclusion: manual
---

# Garmin Connect IQ — Marcador PPC Tennis

## Qué es

App para relojes Garmin que funciona como marcador de tenis del PPC. El jugador lleva el marcador desde la muñeca durante el partido. Fase 1 (actual) es offline. Fase 2 (futuro) sincroniza con el Live Scoreboard de la web via HTTP.

**Código fuente**: `ppc-final/garmin-scoreboard/`
**Documentación completa**: `ppc-final/garmin-scoreboard/README.md`

---

## Estado actual

### ✅ Funcionando (Fase 1 — offline)
- App compila y corre en el simulador de Garmin (Instinct 2)
- 3 formatos: Standard (Bo3, 6 games), SuperTiebreak (2 sets + STB a 10), NextGen (Bo3, 4 games, punto de oro)
- Tiebreak automático en 6-6 (Standard) o 4-4 (NextGen)
- Super Tiebreak a 10 puntos con diferencia de 2
- Undo punto por punto (replay del historial completo)
- Vibración háptica diferenciada (punto / game / set / match)
- Indicador de saque con alternancia automática
- Heart rate + reloj en pantalla
- Activity recording (graba como actividad Tennis/Padel en Garmin Connect)
- Soporte touch + botones físicos
- Menú: Undo, Swap Server, Change Format, Start Recording, Reset, Quit
- Branding "PPC TENNIS" en pantalla
- Formato + número de set visible (ej: "STD S2")
- Sets ganados en la barra de estado

### 🔲 Pendiente (Fase 2 — sync con web)
- Vercel Function `/api/live-score` como proxy Garmin → Supabase
- HTTP POST al registrar cada punto
- HTTP GET polling cada 5s para sincronizar
- Selección de partido activo desde el reloj
- Auth via token (UUID del jugador)

### 🔲 Pendiente (Fase 3 — mejoras)
- Companion app Android/iOS
- Nombres de jugadores en pantalla
- Estadísticas post-partido
- Publicación en Connect IQ Store

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | Monkey C |
| SDK | Garmin Connect IQ SDK 9.1.0 |
| IDE | Kiro (edición) + terminal (compilación) |
| Java | Temurin JDK 21 (requerido por el compilador) |
| Target | Instinct 2/3, Fenix 7, Venu 2/3, FR 265/965, Vivoactive 5 |

---

## Estructura

```
garmin-scoreboard/
├── manifest.xml                    # Dispositivos, permisos, idiomas
├── monkey.jungle                   # Build config
├── README.md                       # Documentación completa
├── .gitignore                      # Excluye bin/, .prg, .der
├── resources/
│   ├── drawables/
│   │   ├── drawables.xml           # Referencia al launcher icon
│   │   ├── launcher_icon.png       # Ícono 40x40 (placeholder verde)
│   │   └── README.md               # Instrucciones para crear ícono real
│   ├── layouts/layout.xml          # Layout de pantalla con PPC branding
│   ├── menus/menu.xml              # Menús (main, format, activity)
│   └── strings/strings.xml         # Textos
└── source/
    ├── PPCScoreApp.mc              # Entry point
    ├── PPCScoreboard.mc            # ⭐ Lógica de puntuación (port de liveScoreUtils.ts)
    ├── PPCScoreView.mc             # Vista (UI con PPC branding)
    ├── PPCScoreDelegate.mc         # Input (botones + touch + vibración)
    ├── PPCMenuDelegate.mc          # Menú principal
    ├── PPCActivityMenuDelegate.mc  # Picker Tennis/Padel
    ├── PPCFormatMenuDelegate.mc    # Picker Standard/STB/NextGen
    └── RecordingManager.mc         # Activity recording
```

---

## Compilación desde terminal

La extensión Monkey C de Garmin NO está disponible en Kiro (usa Open VSX, no el marketplace de Microsoft). La compilación se hace desde terminal:

```powershell
# Configurar Java y SDK
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$sdkBin = "$env:APPDATA\Garmin\ConnectIQ\Sdks\connectiq-sdk-win-9.1.0-2026-03-09-6a872a80b\bin"
$keyPath = "$env:APPDATA\Garmin\ConnectIQ\developer_key.der"

# Compilar para Instinct 2
cmd /c "`"$sdkBin\monkeyc.bat`" -d instinct2 -f garmin-scoreboard\monkey.jungle -o garmin-scoreboard\bin\PPCTennis.prg -y `"$keyPath`""

# Abrir simulador (en background)
& "$sdkBin\simulator.exe"

# Cargar app en simulador (esperar 3s después de abrir simulador)
cmd /c "`"$sdkBin\monkeydo.bat`" garmin-scoreboard\bin\PPCTennis.prg instinct2"
```

### Requisitos instalados
- ✅ Java: Temurin JDK 21 en `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`
- ✅ SDK: Connect IQ SDK 9.1.0 en `%APPDATA%\Garmin\ConnectIQ\Sdks\`
- ✅ Developer Key: `%APPDATA%\Garmin\ConnectIQ\developer_key.der`
- ✅ Devices: Todos descargados en `%APPDATA%\Garmin\ConnectIQ\Devices\`

---

## Controles

### Botones físicos (Instinct, Fenix, Forerunner)
| Botón | Acción |
|-------|--------|
| ENTER / GPS (arriba-derecha) | Punto P1 |
| BACK / ABC (abajo-derecha) | Punto P2 |
| UP (arriba-izquierda) | Menú |
| DOWN (abajo-izquierda) | Undo último punto |

### Touch (Venu, Vivoactive)
| Gesto | Acción |
|-------|--------|
| Tap mitad superior | Punto P1 |
| Tap mitad inferior | Punto P2 |
| Swipe izquierda | Undo |
| Long press | Menú |

---

## Relación con liveScoreUtils.ts

La lógica de `PPCScoreboard.mc` es un port directo de `src/components/LiveScoreboard/liveScoreUtils.ts`:

| Concepto | TypeScript | Monkey C |
|----------|-----------|----------|
| Formatos | `MatchFormat` type | `FORMAT_STANDARD/SUPERTIEBREAK/NEXTGEN` enum |
| Punto | `addPoint(state, player)` → nuevo estado | `addPoint(player)` → muta estado, retorna 0/1/2/3 |
| Undo | `previous_state` snapshot inmutable | `history` array + replay completo |
| Tiebreak | `in_tiebreak` / `in_super_tiebreak` | `inTiebreak` / `inSuperTiebreak` |
| Saque | `getServeAfterTiebreakPoint()` | `updateTiebreakServer()` |
| Display | `formatPointScore()` | `getScore()` / `getGames()` / `getStatusText()` |

---

## Vibración

| Evento | Intensidad | Duración |
|--------|-----------|----------|
| Punto normal | 25% | 50ms |
| Game ganado | 50% | 150ms |
| Set ganado | 80% | 200ms × 2 |
| Match ganado | 100% | 300ms × 2 |
| Undo | 30% | 50ms × 2 |

---

## Alternativas futuras

| Plataforma | Lenguaje | Ventaja | Desventaja |
|------------|----------|---------|------------|
| **Garmin** (actual) | Monkey C | Botones físicos, batería larga | Sin WebSocket, memoria limitada |
| **Apple Watch** | Swift/SwiftUI | WebSocket nativo, pantalla grande | Solo Apple, requiere Mac |
| **Wear OS** | Kotlin | WebSocket, ecosystem Android | Batería corta, fragmentación |
| **PWA** | TypeScript | Ya existe (Live Scoreboard) | Necesita teléfono en cancha |

La lógica de puntuación es la misma para todas — solo cambia el lenguaje y la capa de UI/input.

---

## Instalar en reloj real

### Opción 1: Sideload (desarrollo)
1. Conectar reloj al PC via USB
2. Copiar `garmin-scoreboard/bin/PPCTennis.prg` a `GARMIN/APPS/` en el reloj
3. Desconectar → la app aparece en el menú de actividades

### Opción 2: Connect IQ Store (publicación)
1. Exportar: `monkeyc` con flag `-e` para generar `.iq`
2. Subir a https://apps-developer.garmin.com
3. Garmin revisa (1-5 días) → se publica gratis
4. Los jugadores la instalan desde la app Connect IQ en su teléfono
