# 01 — Crear y Conectar Supabase (Base de Datos)

## ¿Qué es Supabase?

Supabase es tu base de datos online gratuita. Aquí se guardan todos los datos de tu web (usuarios, productos, contenido, etc.). También maneja login de usuarios y almacenamiento de archivos.

---

## Paso 1: Crear cuenta en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Click en "Start your project" o "Sign In"
3. Inicia sesión con tu cuenta de GitHub (recomendado) o Google
4. Ya tienes cuenta ✅

---

## Paso 2: Crear un proyecto

1. En el dashboard, click "New Project"
2. Elige una organización (te crea una por defecto)
3. Completa:
   - **Name**: nombre de tu proyecto (ej: `mi-web-vinos`)
   - **Database Password**: genera una contraseña segura (¡guárdala!)
   - **Region**: elige la más cercana a tus usuarios (ej: `West EU (London)`)
4. Click "Create new project"
5. Espera ~2 minutos a que se cree

---

## Paso 3: Obtener las credenciales

Una vez creado, ve a **Settings → API** (en el menú lateral):

Verás:
- **Project URL**: algo como `https://abcdefghijk.supabase.co`
- **anon public key**: una clave larga que empieza con `eyJ...`
- **service_role key**: otra clave larga (⚠️ esta es SECRETA, nunca la pongas en código público)

Copia estas 3 cosas. Las necesitarás luego.

---

## Paso 4: Crear un archivo .env.local en tu proyecto

En la raíz de tu proyecto web, crea un archivo `.env.local`:

```env
VITE_SUPABASE_URL=https://TU-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...tu-service-role-key
```

> ⚠️ **IMPORTANTE**: Añade `.env.local` a tu `.gitignore` para que NUNCA se suba a GitHub.

---

## Paso 5: Instalar el cliente de Supabase

En la terminal de tu proyecto:

```bash
npm install @supabase/supabase-js
```

---

## Paso 6: Crear el archivo de conexión

Crea `src/lib/supabaseClient.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## Paso 7: Crear tu primera tabla

1. En el dashboard de Supabase, ve a **Table Editor** (menú lateral)
2. Click "New Table"
3. Ejemplo para una web de vinos:
   - **Name**: `wines`
   - Columns:
     - `id` (uuid, Primary Key, auto-generated) ← ya viene por defecto
     - `name` (text, Not Null)
     - `region` (text)
     - `year` (int4)
     - `rating` (float4)
     - `notes` (text)
     - `created_at` (timestamptz, default: `now()`)
4. Click "Save"

---

## Paso 8: Verificar la conexión

En cualquier componente de tu web:

```typescript
import { supabase } from '../lib/supabaseClient'

// Leer datos
const { data, error } = await supabase
  .from('wines')
  .select('*')

console.log(data) // debería mostrar un array (vacío al principio)
```

---

## Paso 9: Activar Row Level Security (RLS)

RLS protege tus datos. Sin RLS, cualquiera podría leer/modificar todo.

1. Ve a **Authentication → Policies** en el dashboard
2. Para cada tabla, activa RLS
3. Crea políticas según necesites:

```sql
-- Ejemplo: cualquiera puede leer vinos
CREATE POLICY "Public can read wines"
ON wines FOR SELECT
USING (true);

-- Ejemplo: solo usuarios logueados pueden insertar
CREATE POLICY "Authenticated users can insert wines"
ON wines FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
```

---

## Paso 10: Activar autenticación (opcional)

Si quieres que los usuarios puedan registrarse/loguearse:

1. Ve a **Authentication → Providers**
2. Activa los que necesites:
   - **Email** (viene activo por defecto)
   - **Google** (necesitas crear credenciales en Google Cloud Console)
3. En tu código:

```typescript
// Registro
const { data, error } = await supabase.auth.signUp({
  email: 'usuario@email.com',
  password: 'contraseña123'
})

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@email.com',
  password: 'contraseña123'
})

// Login con Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google'
})
```

---

## Resumen de credenciales

| Variable | Dónde se usa | Seguridad |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | Frontend (público) | ✅ Seguro exponer |
| `VITE_SUPABASE_ANON_KEY` | Frontend (público) | ✅ Seguro exponer (RLS protege) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor/API | ⚠️ NUNCA exponer en frontend |

---

## ¿Problemas comunes?

| Problema | Solución |
|----------|----------|
| "No rows returned" | ¿Activaste RLS sin crear una política SELECT? |
| "Invalid API key" | Verifica que copiaste bien la anon key |
| "permission denied" | Necesitas una política RLS para esa operación |
| "CORS error" | Verifica que la URL de Supabase es correcta |

---

## Siguiente paso

→ [02-vercel-github-setup.md](./02-vercel-github-setup.md) — Poner tu web online con Vercel
