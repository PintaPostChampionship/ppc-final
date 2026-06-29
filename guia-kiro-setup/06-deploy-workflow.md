# 06 — Flujo Completo: Código → GitHub → Vercel → Web Actualizada

## El flujo resumido

```
1. Haces cambios (o Kiro los hace por ti)
         ↓
2. git add + commit + push
         ↓
3. Vercel detecta el push automáticamente
         ↓
4. Build + Deploy (~30-60 seg)
         ↓
5. Tu web está actualizada ✅
```

---

## Paso a paso detallado

### 1. Hacer cambios en el código

Puedes hacer cambios de dos formas:

**Manualmente** — editas archivos en VS Code / Kiro

**Con Kiro** — le pides que haga los cambios:
> "Añade una nueva página de 'Sobre nosotros' con info del equipo"
> "Cambia el color del header a rojo"
> "Crea un formulario para añadir un nuevo vino"

### 2. Guardar cambios en Git

Después de hacer cambios, hay que "guardarlos" en Git y subirlos a GitHub.

**Opción A — Pedírselo a Kiro:**
> "Haz commit y push de todos los cambios"

Kiro ejecutará:
```bash
git add .
git commit -m "Descripción automática del cambio"
git push
```

**Opción B — Hacerlo tú manualmente:**
```bash
# Ver qué archivos cambiaron
git status

# Añadir todos los cambios
git add .

# Crear un "punto de guardado" (commit)
git commit -m "Añadida página de contacto"

# Subir a GitHub
git push
```

**Opción C — Desde VS Code / Kiro (visual):**
1. Click en el ícono de Source Control (rama) en la barra lateral
2. Verás los archivos que cambiaron
3. Click "+" para staging (equivale a `git add`)
4. Escribe un mensaje arriba y click ✓ (equivale a `git commit`)
5. Click "..." → Push (equivale a `git push`)

### 3. Vercel hace el deploy automáticamente

Una vez que haces push:
1. GitHub avisa a Vercel "hay cambios nuevos"
2. Vercel descarga el código nuevo
3. Ejecuta `npm run build` (compila tu proyecto)
4. Si el build es exitoso → actualiza la web
5. Si falla → la web vieja sigue funcionando (no se rompe)

### 4. Verificar el deploy

- Ve a [vercel.com](https://vercel.com) → tu proyecto → Deployments
- Verás el estado: "Building..." → "Ready" ✅
- Click en la URL para ver tu web actualizada

---

## Configuración inicial (una sola vez)

Para que todo esto funcione automáticamente, necesitas:

1. ✅ Repo en GitHub (ya hecho en paso 02)
2. ✅ Proyecto en Vercel conectado al repo (ya hecho en paso 02)
3. ✅ Variables de entorno en Vercel (ya hecho en paso 02)
4. ✅ Git autenticado en tu máquina (ver abajo)

### Verificar que git está autenticado

```bash
# Intenta hacer push (si no tienes cambios, este comando no hace nada pero muestra si hay error)
git push

# Si dice "Everything up-to-date" → está bien ✅
# Si pide contraseña → configura credential helper
```

### Configurar credenciales de Git (Windows)

```bash
# Usar Windows Credential Manager (guarda tu contraseña)
git config --global credential.helper manager

# Configurar tu identidad
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

La próxima vez que hagas push, te pedirá:
- Username: tu usuario de GitHub
- Password: tu **Personal Access Token** (NO tu contraseña de GitHub)

Después de ingresarlo una vez, Windows lo recuerda para siempre.

---

## Flujo con Kiro (el más cómodo)

El flujo ideal usando Kiro:

```
Tú: "Añade una sección de testimonios en la home"
         ↓
Kiro: Crea los componentes, modifica la página, etc.
         ↓
Tú: "Perfecto, haz commit y push"
         ↓
Kiro: Ejecuta git add, commit, push
         ↓
Vercel: Deploy automático
         ↓
~60 seg después: web actualizada ✅
```

### Comandos útiles para Kiro

| Qué quieres | Qué decirle a Kiro |
|-------------|-------------------|
| Ver cambios pendientes | "¿Qué archivos he modificado?" |
| Commit + push | "Haz commit y push con mensaje: añadido footer" |
| Solo commit (sin push) | "Haz commit de los cambios" |
| Deshacer cambios | "Deshaz los cambios del último archivo que modifiqué" |
| Crear una branch | "Crea una branch llamada feature/nueva-pagina" |
| Ver estado del deploy | "¿Cuál es el estado del último deploy en Vercel?" |

---

## Branches (para cambios grandes)

Para cambios grandes o experimentales, usa branches:

```bash
# Crear y cambiar a una nueva branch
git checkout -b feature/nueva-pagina

# Hacer tus cambios...
# commit...

# Subir la branch
git push -u origin feature/nueva-pagina

# Vercel creará un "Preview Deploy" con URL propia para esa branch
# Cuando estés contento, mergear a main:
git checkout main
git merge feature/nueva-pagina
git push
```

O dile a Kiro:
> "Crea una branch 'feature/reviews', haz los cambios ahí, y cuando termine hazme un PR"

---

## vercel.json — Configuración útil

Crea `vercel.json` en la raíz de tu proyecto:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

- `rewrites`: necesario para SPAs con React Router (evita 404 en rutas)
- `headers`: añade headers de seguridad

---

## ¿Qué pasa si el build falla?

1. Ve a Vercel → Deployments → click en el deploy fallido
2. Lee el log de errores (generalmente dice exactamente qué línea falló)
3. Los errores más comunes:
   - **TypeScript error**: un tipo incorrecto o un import que no existe
   - **Module not found**: falta instalar un paquete (`npm install xxx`)
   - **Variable de entorno undefined**: no la configuraste en Vercel

4. Arregla el error localmente, haz commit + push otra vez
5. Vercel reintentará el deploy automáticamente

> 💡 **Tip**: Antes de hacer push, ejecuta `npm run build` localmente. Si funciona local, funcionará en Vercel.

---

## Resumen del flujo diario

```
Mañana:
  "Kiro, añade una sección de últimos vinos añadidos en la home"
  → Kiro hace los cambios
  → "Genial, haz commit y push"
  → Web actualizada en 60 seg

Tarde:
  "Kiro, cambia el diseño de las tarjetas de vinos para que se vean más elegantes"
  → Kiro modifica los estilos
  → "Push"
  → Web actualizada
```

---

## Siguiente paso

→ [07-tips-importantes.md](./07-tips-importantes.md) — Tips, errores comunes, y buenas prácticas
