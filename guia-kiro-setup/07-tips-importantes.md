# 07 — Tips Importantes, Errores Comunes, y Buenas Prácticas

## 🎯 Cómo hablarle a Kiro (mejores resultados)

### Sé específica con lo que quieres

❌ Malo: "Haz una web de vinos"
✅ Bueno: "Crea una página que muestre una lista de vinos con nombre, región, año y puntuación. Usa tarjetas con diseño elegante, colores burdeos y dorado"

❌ Malo: "Arregla el error"
✅ Bueno: "Hay un error en la página de login: al hacer click en 'Entrar' no pasa nada. ¿Puedes revisarlo?"

### Divide tareas grandes en pasos

En vez de:
> "Crea una app completa de catálogo de vinos con login, búsqueda, favoritos, y panel de admin"

Mejor:
> 1. "Crea la estructura básica del proyecto con React + Tailwind"
> 2. "Añade la conexión a Supabase"
> 3. "Crea la tabla 'wines' con estos campos: ..."
> 4. "Crea una página que muestre la lista de vinos"
> 5. "Añade un formulario para agregar vinos nuevos"
> 6. "Añade login con Google"

### Usa contexto (#)

En el chat de Kiro puedes referenciar cosas:
- `#File` → selecciona un archivo para que Kiro lo vea
- `#Folder` → selecciona una carpeta
- `#Problems` → muestra errores del editor
- `#Terminal` → muestra lo que hay en tu terminal
- `#Git Diff` → muestra los cambios que hiciste

Ejemplo:
> "Hay un error en #Problems ¿puedes arreglarlo?"

---

## 🛠️ Stack recomendado para empezar

Si no sabes qué tecnología usar, esta combinación es la más fácil y moderna:

| Necesidad | Solución | Por qué |
|-----------|----------|---------|
| Framework | React + Vite | Rápido, popular, mucha documentación |
| Estilos | Tailwind CSS | No necesitas CSS, todo con clases |
| Lenguaje | TypeScript | Te avisa de errores antes de ejecutar |
| Base de datos | Supabase | Gratis, fácil, tiene de todo |
| Hosting | Vercel | Gratis, auto-deploy, cero config |
| Control de versiones | GitHub | Estándar de la industria |

### Crear un proyecto nuevo desde cero

```bash
# Crear proyecto React + TypeScript + Vite
npm create vite@latest mi-proyecto -- --template react-ts

# Entrar al directorio
cd mi-proyecto

# Instalar dependencias
npm install

# Instalar Tailwind CSS
npm install -D tailwindcss @tailwindcss/vite

# Instalar Supabase
npm install @supabase/supabase-js

# Verificar que funciona
npm run dev
```

O dile a Kiro:
> "Crea un proyecto nuevo con React, TypeScript, Vite, Tailwind y Supabase. El tema es [tu tema]"

---

## 📁 .gitignore — Archivos que NUNCA deben subir a GitHub

Crea un `.gitignore` en la raíz:

```gitignore
# Dependencias
node_modules/

# Variables de entorno (contienen secretos)
.env
.env.local
.env.*.local

# Build output
dist/

# IDE
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Kiro settings con tokens
.kiro/settings/mcp.json

# Logs
*.log
```

> ⚠️ **IMPORTANTE**: Si accidentalmente subiste un archivo con secretos a GitHub, cambiar la contraseña/token inmediatamente (aunque lo borres del repo, queda en el historial).

---

## 🔒 Seguridad básica

### Regla #1: Nunca pongas secretos en código

❌ Malo:
```typescript
const supabase = createClient(
  'https://abc.supabase.co',
  'eyJ...mi-clave-secreta...'  // NUNCA hacer esto
)
```

✅ Bueno:
```typescript
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Regla #2: La anon key es "segura" de exponer

La `VITE_SUPABASE_ANON_KEY` está diseñada para usarse en el frontend. La seguridad viene de RLS (Row Level Security), no de esconder la key.

### Regla #3: La service_role key es SECRETA

La `SUPABASE_SERVICE_ROLE_KEY` bypasea toda la seguridad. Solo usarla en:
- Vercel Functions (serverless, nunca llega al navegador)
- Scripts locales (nunca subir a GitHub)

---

## 🐛 Errores comunes y soluciones

### Error: "Cannot find module..."
```
Error: Cannot find module '@supabase/supabase-js'
```
**Solución**: `npm install @supabase/supabase-js`

### Error: "VITE_ variable is undefined"
```
TypeError: Cannot read properties of undefined
```
**Soluciones**:
1. ¿El nombre empieza con `VITE_`? Solo variables con ese prefijo llegan al frontend
2. ¿Creaste el `.env.local`? ¿Está en la raíz del proyecto?
3. ¿Reiniciaste el servidor de desarrollo después de crear/modificar el `.env.local`?

### Error: "RLS policy violation"
```
new row violates row-level security policy
```
**Solución**: Ve a Supabase → Authentication → Policies → Crea una política que permita la operación

### Error: "Build failed" en Vercel
**Solución**: 
1. Lee el log completo del error
2. Ejecuta `npm run build` localmente para reproducir
3. Los errores de TypeScript son los más comunes: arregla los tipos
4. ¿Falta una variable de entorno en Vercel?

### Error: "git push rejected"
```
! [rejected] main -> main (non-fast-forward)
```
**Solución**:
```bash
git pull --rebase
git push
```

### Error: "Hydration mismatch" o pantalla en blanco
**Causas comunes**:
- Un componente accede a `window` o `document` durante el server render
- Datos undefined que no se manejan con loading state

---

## 💡 Buenas prácticas

### 1. Siempre tener un loading state

```typescript
const [wines, setWines] = useState<Wine[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  supabase.from('wines').select('*').then(({ data }) => {
    setWines(data || [])
    setLoading(false)
  })
}, [])

if (loading) return <p>Cargando...</p>
```

### 2. Manejar errores

```typescript
const { data, error } = await supabase.from('wines').select('*')
if (error) {
  console.error('Error:', error.message)
  // Mostrar mensaje al usuario
  return
}
```

### 3. Commits frecuentes

Haz commit después de cada cambio funcional:
- ✅ "Añadida página de lista de vinos" → commit
- ✅ "Implementado formulario de nuevo vino" → commit
- ✅ "Corregido bug en el filtro de búsqueda" → commit

No acumules 20 cambios en un solo commit gigante.

### 4. Usa TypeScript types

```typescript
// types.ts
interface Wine {
  id: string
  name: string
  region: string
  year: number
  rating: number
  notes?: string
}
```

Kiro genera tipos mucho mejores si le dices qué forma tienen tus datos.

### 5. Nombra bien las cosas

❌ `data`, `stuff`, `item`, `thing`
✅ `wines`, `selectedWine`, `wineRating`, `addWineForm`

---

## 🚀 Workflow ideal con Kiro

### Para un día productivo:

1. **Abre Kiro** con tu proyecto
2. **Revisa** qué quieres hacer hoy (una feature o fix)
3. **Dile a Kiro** qué necesitas, paso a paso
4. **Revisa** los cambios que hace (Kiro te muestra diffs)
5. **Prueba** en el navegador (`npm run dev`)
6. **Si funciona** → "Haz commit y push" → web actualizada
7. **Si hay error** → "Hay un error: [descripción]" → Kiro lo arregla

### Frases útiles para Kiro:

| Situación | Qué decir |
|-----------|-----------|
| Empezar feature | "Quiero añadir [X]. ¿Cómo lo hacemos?" |
| Ver errores | "Revisa #Problems y arregla los errores" |
| Entender código | "Explícame qué hace este componente" |
| Mejorar diseño | "Haz que esta página se vea más moderna/profesional" |
| Debug | "Al hacer click en [X] no pasa nada. ¿Por qué?" |
| Deploy | "Haz commit con mensaje '[X]' y push" |
| Rollback | "Deshaz el último commit" |

---

## 📚 Recursos útiles

| Recurso | URL | Para qué |
|---------|-----|----------|
| Supabase Docs | supabase.com/docs | Todo sobre la base de datos |
| Tailwind CSS | tailwindcss.com | Buscar clases de estilo |
| React Docs | react.dev | Aprender React |
| Vercel Docs | vercel.com/docs | Configuración de deploy |
| TypeScript | typescriptlang.org | Referencia del lenguaje |

---

## 🎓 Resumen final

1. **Supabase** = tu base de datos (gratis, fácil)
2. **GitHub** = donde vive tu código (backup + historial)
3. **Vercel** = pone tu web online (auto-deploy)
4. **Kiro** = tu asistente que escribe código por ti
5. **Steering files** = instrucciones para que Kiro entienda tu proyecto
6. **MCP** = conexiones directas (Kiro ↔ Supabase, Kiro ↔ GitHub)
7. **Agentes** = personalidades especializadas de Kiro

El flujo es: **tú decides qué hacer** → **Kiro implementa** → **git push** → **web actualizada** 🎉

---

## ¿Necesitas ayuda?

Si algo no funciona, dile a Kiro:
> "Tengo un problema con [X]. El error es [Y]. ¿Puedes ayudarme?"

Kiro puede leer logs, ver errores, buscar en internet, y proponer soluciones. No tengas miedo de preguntar. 🙌
