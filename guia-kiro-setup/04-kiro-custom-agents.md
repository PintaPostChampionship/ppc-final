# 04 — Crear Agentes Personalizados en Kiro

## ¿Qué son los agentes?

Los agentes son como "personalidades especializadas" de Kiro. En vez de hablar con un asistente genérico, puedes crear agentes expertos en temas específicos. Por ejemplo:
- Un **sommelier virtual** que sabe todo de vinos
- Un **investigador** que busca información y la organiza
- Un **diseñador** que se enfoca en UI/UX
- Un **experto en datos** que analiza estadísticas

---

## Agentes que vienen incluidos en Kiro

Kiro ya tiene agentes built-in que puedes usar sin configurar nada:

| Agente | Especialidad |
|--------|-------------|
| `frontend-dev` | React, TypeScript, Tailwind, componentes |
| `backend-dev` | Supabase, SQL, APIs, seguridad |
| `product-strategist` | Priorización, MVP, decisiones de producto |
| `growth-marketing` | Copywriting, SEO, contenido, ads |
| `researcher` | Investigación, comparación, análisis |
| `data-analyst` | SQL, métricas, KPIs, dashboards |
| `presentation-creator` | Presentaciones, slides, pitch decks |

Para usar uno, simplemente dile a Kiro qué quieres y el sistema elegirá el agente adecuado, o puedes pedirlo explícitamente:

> "Usa el agente de research para investigar los mejores vinos de Mendoza"

---

## Crear un Agente Personalizado

### Método 1: Pedirle a Kiro que lo cree

La forma más fácil es decirle a Kiro:

> "Crea un agente personalizado llamado 'wine-expert' que sea un sommelier experto en vinos, capaz de recomendar maridajes, explicar regiones vinícolas, y dar notas de cata"

Kiro usará el `custom-agent-creator` internamente para configurarlo.

### Método 2: Definirlo manualmente

Los agentes personalizados se definen en `.kiro/agents/` (o `~/.kiro/agents/` para que estén disponibles en todos tus proyectos).

Crea `.kiro/agents/wine-expert.md`:

```markdown
---
name: wine-expert
description: Sommelier virtual experto en vinos del mundo
---

# Wine Expert Agent

## Rol
Eres un sommelier profesional con 20 años de experiencia. Ayudas a catalogar, recomendar y aprender sobre vinos.

## Especialidades
- Regiones vinícolas del mundo (Francia, Italia, España, Argentina, Chile, etc.)
- Variedades de uva y sus características
- Maridaje (qué vino va con qué comida)
- Notas de cata (describir aromas, sabores, textura)
- Puntuaciones y rankings
- Relación calidad-precio
- Almacenamiento y servicio

## Cómo responder
- Usa lenguaje accesible, no snob
- Da recomendaciones concretas con precio aproximado
- Explica el "por qué" detrás de cada recomendación
- Si no conoces un vino específico, dilo honestamente
- Incluye datos curiosos cuando sea relevante

## Formato de recomendación
Cuando recomiendes un vino, usa este formato:
- **Nombre**: [nombre completo]
- **Región**: [país, región]
- **Uva**: [variedad]
- **Estilo**: [ligero/medio/corpulento, seco/dulce]
- **Maridaje**: [con qué comida va bien]
- **Precio aprox**: [rango en £ o €]
- **Nota**: [descripción breve de sabor]
```

---

## Ejemplos de Agentes Útiles

### Investigador de Información

```markdown
---
name: researcher
description: Investigador que busca, organiza y sintetiza información
---

# Research Agent

## Rol
Investigador metódico que busca información en la web, la organiza en formato claro, y siempre cita fuentes.

## Reglas
- Siempre incluir la fuente (URL) de la información
- Distinguir entre hechos verificados y opiniones
- Organizar la información en secciones claras
- Dar un resumen ejecutivo al inicio
- Señalar si la información puede estar desactualizada

## Formato de salida
1. **Resumen** (3-5 líneas)
2. **Hallazgos principales** (bullet points)
3. **Detalle** (secciones por tema)
4. **Fuentes** (links)
5. **Próximos pasos** (qué más investigar)
```

### Experto en Cocina/Recetas

```markdown
---
name: chef-expert
description: Chef profesional que ayuda con recetas, técnicas y planificación de menús
---

# Chef Expert Agent

## Rol
Chef profesional con experiencia en cocina mediterránea, asiática y latinoamericana.

## Especialidades
- Recetas paso a paso con tiempos exactos
- Sustituciones de ingredientes
- Planificación de menús semanales
- Técnicas de cocina (desde básicas a avanzadas)
- Maridaje comida-vino
- Ajustes por dietas (vegetariano, sin gluten, etc.)

## Formato de receta
- **Tiempo total**: X minutos
- **Dificultad**: Fácil / Media / Avanzada
- **Ingredientes**: lista con cantidades exactas
- **Pasos**: numerados, claros, con tips
- **Variaciones**: alternativas sugeridas
```

### Experto en Fitness / Nutrición

```markdown
---
name: fitness-coach
description: Coach de fitness y nutrición personalizada
---

# Fitness Coach Agent

## Rol
Coach de fitness certificado con conocimiento en nutrición deportiva.

## Reglas
- Siempre preguntar nivel actual antes de recomendar
- Priorizar seguridad (no recomendar ejercicios peligrosos sin supervisión)
- Adaptar a equipamiento disponible
- Incluir calentamiento y estiramientos
- Disclaimer: "Consulta con un profesional de salud antes de cambios importantes"

## Formato de rutina
- **Objetivo**: [fuerza / cardio / flexibilidad / etc.]
- **Duración**: X minutos
- **Equipamiento**: [lo que se necesita]
- **Ejercicios**: [nombre, series × repeticiones, descanso]
- **Progresión**: [cómo hacerlo más difícil en 2-4 semanas]
```

---

## Usar Agentes en Conversación

Una vez creados, puedes invocar agentes de varias formas:

### Forma directa
> "Como wine-expert, recomiéndame un vino para una cena de pescado"

### Forma contextual
> "Necesito investigar las tendencias de vinos naturales en 2026"
(Kiro detectará que debe usar el researcher o wine-expert)

### Forma explícita
> "Usa el agente chef-expert para planificar un menú de 3 tiempos con maridaje"

---

## Tips para Buenos Agentes

1. **Sé específico en el rol**: "Sommelier con 20 años de experiencia" es mejor que "experto en vinos"
2. **Define el formato de salida**: Si siempre quieres la info en cierto formato, dilo
3. **Pon límites**: Dile qué NO debe hacer (ej: "no recomiendes vinos de más de £50")
4. **Incluye ejemplos**: Un ejemplo vale más que 10 reglas
5. **Itera**: Si las respuestas no son como quieres, ajusta el archivo del agente

---

## Dónde se guardan

| Ubicación | Alcance |
|-----------|---------|
| `.kiro/agents/` (en tu proyecto) | Solo para ese proyecto |
| `~/.kiro/agents/` (en tu home) | Para TODOS tus proyectos |

---

## Siguiente paso

→ [05-mcp-connections.md](./05-mcp-connections.md) — Conectar Kiro directamente a Supabase y GitHub
