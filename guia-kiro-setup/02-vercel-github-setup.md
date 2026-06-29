# 02 — Crear Cuenta en Vercel y Conectar GitHub

## ¿Qué es Vercel?

Vercel es donde vive tu web en internet. Cada vez que haces un cambio y lo subes a GitHub, Vercel automáticamente actualiza tu web. Gratis para proyectos personales.

---

## Parte A: Preparar GitHub

### Paso 1: Crear cuenta en GitHub (si no tienes)

1. Ve a [github.com](https://github.com)
2. Click "Sign up"
3. Sigue los pasos (email, contraseña, username)

### Paso 2: Crear un repositorio

1. En GitHub, click el "+" arriba a la derecha → "New repository"
2. Completa:
   - **Repository name**: nombre de tu proyecto (ej: `mi-web-vinos`)
   - **Visibility**: Private (recomendado) o Public
   - **NO** marques "Add a README" (lo crearemos localmente)
3. Click "Create repository"
4. GitHub te mostrará instrucciones — las usaremos en el paso siguiente

### Paso 3: Conectar tu proyecto local con GitHub

En la terminal, dentro de tu carpeta del proyecto:

```bash
# Inicializar git (solo si no lo has hecho)
git init

# Añadir todos los archivos
git add .

# Primer commit
git commit -m "Proyecto inicial"

# Conectar con GitHub (usa la URL que te dio GitHub)
git remote add origin https://github.com/TU-USUARIO/mi-web-vinos.git

# Subir el código
git push -u origin main
```

> Si te pide credenciales, usa tu username de GitHub y un **Personal Access Token** como contraseña (GitHub ya no acepta contraseñas normales para git).

### Crear un Personal Access Token (PAT)

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)"
3. Nombre: "git push" / Expiration: 90 days / Scopes: ✅ `repo`
4. Click "Generate token"
5. **Copia el token** (solo se muestra una vez)
6. Úsalo como contraseña cuando git te la pida

---

## Parte B: Crear Cuenta en Vercel

### Paso 4: Registrarse en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. **Elige "Continue with GitHub"** ← esto es clave para el auto-deploy
4. Autoriza Vercel a acceder a tu GitHub
5. Ya tienes cuenta ✅

### Paso 5: Importar tu proyecto

1. En el dashboard de Vercel, click "Add New..." → "Project"
2. Verás tu lista de repos de GitHub
3. Busca tu repo (ej: `mi-web-vinos`) y click "Import"
4. Vercel detectará automáticamente el framework (Vite, Next.js, etc.)
5. **Configurar variables de entorno** (IMPORTANTE):
   - Click "Environment Variables"
   - Añade cada variable de tu `.env.local`:

   | Key | Value |
   |-----|-------|
   | `VITE_SUPABASE_URL` | `https://tu-project-id.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...tu-anon-key` |

   > ⚠️ NO añadas `SUPABASE_SERVICE_ROLE_KEY` a menos que tengas funciones serverless que la necesiten

6. Click "Deploy"
7. Espera ~30-60 segundos
8. ¡Tu web está online! 🎉 Vercel te da una URL tipo `mi-web-vinos.vercel.app`

---

## Parte C: Auto-Deploy (magia ✨)

Una vez conectado, cada vez que hagas push a GitHub, Vercel automáticamente:
1. Detecta el cambio
2. Hace build de tu proyecto
3. Actualiza la web en producción

### Flujo de trabajo diario

```bash
# 1. Haces cambios en tu código (o Kiro los hace por ti)

# 2. Guardas los cambios en git
git add .
git commit -m "Descripción del cambio"

# 3. Subes a GitHub
git push

# 4. Vercel detecta el push y actualiza la web automáticamente (30-60 seg)
```

No necesitas hacer nada más. Es automático.

---

## Parte D: Dominio personalizado (opcional)

Si quieres una URL propia (ej: `miweb.com` en vez de `mi-web-vinos.vercel.app`):

1. Compra un dominio en Namecheap, GoDaddy, Google Domains, etc.
2. En Vercel → tu proyecto → Settings → Domains
3. Añade tu dominio
4. Vercel te dará las DNS records que debes configurar en tu proveedor de dominio
5. Espera ~24h a que se propague

---

## Parte E: Conectar Supabase con Vercel (integración oficial)

Vercel tiene una integración oficial con Supabase que autoconfigura las variables de entorno:

1. En Vercel → tu proyecto → Settings → Integrations
2. Busca "Supabase"
3. Click "Add Integration"
4. Autoriza y selecciona tu proyecto de Supabase
5. Vercel automáticamente añadirá las variables de entorno necesarias

> Esto es opcional — si ya configuraste las variables manualmente, no es necesario.

---

## Resumen visual del flujo

```
Tu código (local)
      ↓  git push
GitHub (repositorio)
      ↓  webhook automático
Vercel (build + deploy)
      ↓
Tu web online (actualizada)
      ↕  lee/escribe datos
Supabase (base de datos)
```

---

## ¿Problemas comunes?

| Problema | Solución |
|----------|----------|
| "Build failed" en Vercel | Revisa el log de errores. Generalmente es un error de TypeScript o un import roto |
| Las variables de entorno no funcionan | ¿Las añadiste en Vercel? Para Vite deben empezar con `VITE_` |
| "Page not found" en rutas | Si usas React Router, necesitas un `vercel.json` con rewrites |
| Push rechazado por GitHub | ¿Usaste PAT como contraseña? ¿El token tiene scope `repo`? |
| Vercel no detecta el push | ¿Conectaste con "Continue with GitHub"? Revisa Settings → Git |

### vercel.json para Single Page Apps (SPA)

Si tu web usa React Router y las rutas dan 404, crea `vercel.json` en la raíz:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Siguiente paso

→ [03-kiro-steering-files.md](./03-kiro-steering-files.md) — Hacer que Kiro entienda tu proyecto
