# 03 — Archivos Steering: Hacer que Kiro Entienda tu Proyecto

## ¿Qué son los Steering Files?

Son archivos `.md` (markdown) que le dan contexto a Kiro sobre tu proyecto. Piensa en ellos como "instrucciones permanentes" que Kiro lee cada vez que le hablas. Sin ellos, Kiro no sabe nada sobre tu proyecto. Con ellos, Kiro sabe exactamente qué stack usas, cómo está organizado, y qué reglas seguir.

---

## Dónde van

En la raíz de tu proyecto, dentro de la carpeta `.kiro/steering/`:

```
mi-proyecto/
├── .kiro/
│   └── steering/
│       ├── proyecto-contexto.md    ← contexto general
│       ├── base-de-datos.md        ← estructura de tu DB
│       └── reglas-seguridad.md     ← reglas que Kiro debe seguir
├── src/
├── package.json
└── ...
```

---

## Paso 1: Crear la estructura de carpetas

```bash
# En la raíz de tu proyecto
mkdir -p .kiro/steering
```

O simplemente dile a Kiro: "Crea la carpeta .kiro/steering en mi proyecto"

---

## Paso 2: Crear el archivo de contexto principal

Este es el archivo MÁS importante. Le dice a Kiro qué es tu proyecto.

Crea `.kiro/steering/proyecto-contexto.md`:

```markdown
# Mi Proyecto — Contexto

## Qué es

[Descripción corta de tu proyecto. Ej: "Web de catálogo de vinos con reseñas y puntuaciones"]

**URL**: [tu-url.vercel.app]
**Repo**: [tu-usuario/tu-repo en GitHub]

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth) |
| Hosting | Vercel |

---

## Estructura del proyecto

[Lista las carpetas principales y qué contiene cada una]

```
mi-proyecto/
├── src/
│   ├── components/    ← Componentes de React
│   ├── lib/           ← Utilidades y cliente Supabase
│   ├── pages/         ← Páginas principales
│   └── types/         ← Tipos TypeScript
├── public/            ← Archivos estáticos
└── api/               ← Funciones serverless (Vercel)
```

---

## Variables de entorno

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

---

## Comandos

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run lint     # Linter
```
```

---

## Paso 3: Crear el archivo de base de datos

Crea `.kiro/steering/base-de-datos.md`:

```markdown
# Base de Datos — Supabase

## Conexión

- **Proyecto**: [nombre]
- **URL**: https://[project-id].supabase.co
- **Region**: [London / Frankfurt / etc]

---

## Tablas

### `nombre_tabla`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK, auto-generado |
| nombre | text | Nombre del item |
| created_at | timestamp | Fecha de creación |

[Repite para cada tabla]

---

## Relaciones

- `tabla_a.campo_id` → `tabla_b.id`

---

## RLS (Row Level Security)

- Tabla X: lectura pública, escritura solo autenticados
- Tabla Y: solo el dueño puede ver/editar sus registros
```

---

## Paso 4: Crear reglas de seguridad (opcional pero recomendado)

Crea `.kiro/steering/reglas.md`:

```markdown
# Reglas para Kiro

## Base de datos

- NUNCA borrar tablas ni columnas existentes
- Para consultas de lectura (SELECT), proceder libremente
- Para cambios destructivos, preguntar antes

## Código

- Antes de modificar un archivo, leer su contenido actual
- No modificar .env.local sin instrucción explícita
- Preferir cambios pequeños sobre refactors grandes
```

---

## Tipos de inclusión

Los steering files tienen 3 modos:

### 1. Siempre incluido (por defecto)

Se lee en CADA conversación con Kiro. Ideal para contexto general.

```markdown
# Mi contexto
(sin front-matter = siempre incluido)
```

### 2. Condicional (cuando se lee un archivo específico)

Se incluye solo cuando Kiro lee un archivo que coincide con el patrón.

```markdown
---
inclusion: fileMatch
fileMatchPattern: "src/components/Wine*"
---

# Contexto de componentes de vinos

Estos componentes usan la tabla `wines` de Supabase...
```

### 3. Manual (el usuario lo activa con #)

Se incluye solo cuando tú escribes `#nombre-del-archivo` en el chat.

```markdown
---
inclusion: manual
---

# Guía de estilos

Los colores del proyecto son...
```

---

## Referencia a otros archivos

Puedes incluir otros archivos dentro de un steering file:

```markdown
# Mi contexto

El schema de la API está definido aquí:
#[[file:src/types/index.ts]]
```

Esto le dice a Kiro que lea ese archivo cuando procese el steering.

---

## Ejemplos reales de steering files útiles

### Para una web de vinos

```markdown
# Vinos App — Contexto

## Qué es
Catálogo personal de vinos con notas de cata, puntuaciones, y fotos.

## Tabla principal: wines
- id, name, region, country, grape, year, rating (1-5), notes, image_url, created_by

## Funcionalidades
1. Buscar vinos por nombre/región/uva
2. Añadir nuevo vino con foto
3. Dar puntuación 1-5 estrellas
4. Ver historial de vinos probados
5. Filtrar por país o tipo de uva

## Diseño
- Paleta: borgoña (#722F37), dorado (#DAA520), crema (#FFF8DC)
- Fuente: serif para títulos, sans-serif para cuerpo
- Estilo: elegante pero moderno
```

### Para una web de research

```markdown
# Research Hub — Contexto

## Qué es
Web para organizar investigaciones, guardar links, tomar notas, y generar resúmenes.

## Tablas
- topics: temas de investigación
- sources: URLs con título y resumen
- notes: notas vinculadas a topics

## Reglas
- Los resúmenes deben ser concisos (máx 200 palabras)
- Siempre citar la fuente original
- Formato markdown para las notas
```

---

## Tips

1. **Sé específico**: Cuanto más detalle le des a Kiro, mejores respuestas obtienes
2. **Actualiza los archivos**: Cuando tu proyecto cambie, actualiza los steering files
3. **No pongas secretos**: Nunca pongas passwords o keys reales en los steering files (se comparten con Kiro cloud)
4. **Usa tablas**: Las tablas markdown son ideales para describir schemas de DB
5. **Incluye comandos**: Dile a Kiro cómo buildear, testear, y deployar

---

## Verificar que Kiro los lee

Después de crear tus steering files, abre una nueva conversación con Kiro y pregunta:

> "¿Qué sabes sobre mi proyecto?"

Si Kiro te responde con información de tus steering files, están funcionando. Si no sabe nada, verifica que:
- Los archivos están en `.kiro/steering/`
- Tienen extensión `.md`
- No tienen errores de sintaxis en el front-matter (si usas `inclusion:`)

---

## Siguiente paso

→ [04-kiro-custom-agents.md](./04-kiro-custom-agents.md) — Crear agentes especializados
