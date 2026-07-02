---
inclusion: manual
---

# Garmin App + Web Analytics — Pendientes (julio 2026)

## Estado actual
- App en Garmin Connect IQ Store: **PPC Tennis Scorer** v1.1.0 (publicada)
- v1.1.1 compilada con GPS + fix Change Format (`.iq` en `c:\Users\jifon\projects\marcador-garmin\bin\PPCTennis.iq`) — FALTA SUBIR A LA STORE
- Web: tabs en Marcador (En Vivo con Twitch siempre visible, Jugar, Historial, Garmin) — FALTA DEPLOY
- API: `/api/live-score` fix aplicado — FALTA DEPLOY
- Todo en español en la web

## Para hacer DEPLOY ahora:
1. `cd c:\Users\jifon\ppc-final`
2. `git add -A && git commit -m "tabs marcador, analytics, twitch, filtros español" && git push`
3. Esperar que se deploya automáticamente (o hacer `npx vercel --prod` si no hay auto-deploy)

## Para subir .iq v1.1.1:
1. Ir a https://apps.garmin.com/developer
2. Upload new version del .iq en `c:\Users\jifon\projects\marcador-garmin\bin\PPCTennis.iq`
3. Version: 1.1.1
4. What's New: "GPS tracking, fix Change Format not resetting score, improved sync reliability"

## Archivos modificados sin commit/deploy

### ppc-final (web):
- `api/live-score.ts` — fix línea duplicada + initialsMap + match status fallback + save_log endpoint + polling fallback
- `src/components/MatchAnalytics.tsx` — tabs, filtros español, selector de partido, gráficos nuevos (Momentum, Intensity Scatter, HR vs Win Rate), rival names
- `src/components/GarminPairSection.tsx` — sessionStorage fix, polling fix
- `src/components/LiveScoreboard/useLiveScore.ts` — polling fallback cada 5s
- `src/App.tsx` — tabs en Marcador (En Vivo, Jugar, Historial, Garmin) + marcadorTab state
- `src/types/index.ts` — garmin_paired_at field
- `api/garmin-pair.ts` — endpoint de vinculación
- `api/privacy.ts` — privacy policy

### marcador-garmin (Garmin app):
- Botones invertidos (LEFT=puntos, RIGHT=menu/undo)
- Layout invertido (Rival arriba rojo, Me abajo verde)
- HR arc curvo con zonas + indicador
- Serve indicator verde a la derecha del nombre
- GPS activo durante partido
- FIT fields (winner, sets, serve %)
- Pause Match + Resume
- Save & Exit vs Quit without saving
- Quit termina el Live en la web (ambas opciones)
- Change Format no resetea el marcador
- Undo múltiple (stack 20)
- Venu 4 (41mm, 45mm) soporte
- Iniciales del rival (M.O.) en Go Live
- Sync resiliente (no se desconecta al primer error)
- Connect antes de switchToView (fix del sync)

## Pendientes por hacer

### Prioridad ALTA (antes del jueves 3 julio):
1. **DEPLOY WEB** — push + deploy de todos los cambios de ppc-final (YA LISTO PARA PUSH)
2. **SUBIR .iq v1.1.1** a la Store (GPS + fix Change Format)
3. **Verificar Go Live funciona** — hacer prueba: iniciar Go Live desde reloj → marcador aparece en tab En Vivo de la web
4. **Verificar Twitch aparece** — abrir tab En Vivo → iframe de Twitch debe ser visible siempre

### Prioridad MEDIA (esta semana):
5. **Franjas de HR en gráficos** — agregar bandas de color de fondo al gráfico HR en MatchAnalytics.tsx:
   - <120 bpm: azul claro semi-transparente, label "Descanso"
   - 120-150: verde semi-transparente, label "Moderado" 
   - 150-170: amarillo semi-transparente, label "Intenso"
   - >170: rojo semi-transparente, label "Máximo"
   - Que se vea de un vistazo si el partido fue tranquilo o exigente
6. **Análisis con IA por partido** — botón "📝 Análisis" en cada partido del Historial:
   - Al presionar: llama a una API (OpenAI o Kiro via dispatch como el bot Telegram)
   - Envía: point_log resumido, HR stats, resultado, duración, datos del rival
   - IA genera: resumen narrativo del partido, puntos fuertes/débiles, comparación con partidos anteriores, recomendaciones
   - Guardar resultado en nuevo campo `analysis_text` (agregar columna a `match_point_logs`)
   - Mostrar debajo del header del partido en el detalle
7. **Notificación push al iniciar Go Live** — avisar a todos los jugadores "🔴 Partido en vivo: Javier vs Mario — Ver ahora"

### Prioridad BAJA (futuro):
8. **Stand By** — pausar y retomar partido otro día (ya implementado en Garmin, falta testear)
9. **GPS en la web** — requiere OAuth con Garmin Connect API (complejo)
10. **Más cruces de datos** — tendencias entre partidos, evolución mes a mes
11. **Subir versión a Store** cada vez que haya cambios estables

## Datos del partido del 30 de junio
- Match ID: `a460bd8c-7b55-4a35-968a-f850eb1da516` (vs Mario Orellana)
- Resultado: 6-2, 6-7, 6-10 (perdí el super tiebreak)
- Point log: `f3d28950-0890-4e52-80aa-6fcc8fe0e0bb` (150 puntos, HR avg 151, max 173, 1476 cal)

## Próximo partido: jueves 3 de julio
- Necesita: Go Live funcionando + Twitch embed + marcador web actualizándose

## Contexto técnico
- Garmin source: `c:\Users\jifon\projects\marcador-garmin\`
- Web source: `c:\Users\jifon\ppc-final\`
- Supabase project: `tzmbznenarrpjayntyjt`
- Tabla analytics: `match_point_logs`
- Tabla pairing: `garmin_pairing_codes`
- Store URL: https://apps.garmin.com/apps/54b355b9-097a-4192-a115-48107e4269c8
