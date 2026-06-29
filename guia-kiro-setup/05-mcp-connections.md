# 05 — Conexiones MCP: Kiro Conectado a Supabase y GitHub

## ¿Qué es MCP?

MCP (Model Context Protocol) permite que Kiro se conecte directamente a servicios externos como Supabase o GitHub. En vez de copiar/pegar queries SQL o hacer comandos git manualmente, Kiro puede:
- Consultar y modificar tu base de datos directamente
- Hacer push a GitHub
- Crear tablas, ver datos, ejecutar migraciones
- Todo desde el chat

---

## Parte A: Conectar Supabase

### Paso 1: Obtener tu Access Token de Supabase

1. Ve a [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Click "Generate new token"
3. Nombre: "Kiro MCP"
4. Click "Generate token"
5. **Copia el token** (solo se muestra una vez)

### Paso 2: Obtener tu Project Reference ID

Tu Project Reference es la parte de tu URL de Supabase:
- URL: `https://abcdefghijk.supabase.co`
- Project Ref: `abcdefghijk`

También lo encuentras en: Dashboard → Settings → General → Reference ID

### Paso 3: Crear el archivo de configuración MCP

Opción A — **Para un solo proyecto** (recomendado al inicio):

Crea `.kiro/settings/mcp.json` en la raíz de tu proyecto:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "TU_SUPABASE_ACCESS_TOKEN",
        "--project-ref",
        "TU_PROJECT_REF_ID"
      ],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Opción B — **Para todos tus proyectos** (global):

Crea el archivo en `~/.kiro/settings/mcp.json` (tu carpeta home):
- Windows: `C:\Users\TU_USUARIO\.kiro\settings\mcp.json`
- Mac: `~/.kiro/settings/mcp.json`

Mismo contenido que arriba.

### Paso 4: Reemplazar los valores

Reemplaza:
- `TU_SUPABASE_ACCESS_TOKEN` → el token del Paso 1
- `TU_PROJECT_REF_ID` → el reference ID del Paso 2

### Paso 5: Verificar la conexión

1. Reinicia Kiro (o recarga la ventana: Ctrl+Shift+P → "Reload Window")
2. Abre el panel de MCP Servers (barra lateral → icono de MCP o Command Palette → "MCP")
3. Deberías ver "supabase" con estado verde (connected)
4. Prueba preguntándole a Kiro: "¿Qué tablas tengo en mi base de datos?"

### ¿Qué puede hacer Kiro con Supabase MCP?

| Acción | Ejemplo |
|--------|---------|
| Ver tablas | "Muéstrame todas las tablas" |
| Consultar datos | "¿Cuántos registros hay en la tabla wines?" |
| Crear tablas | "Crea una tabla 'reviews' con campos rating, comment, wine_id" |
| Ejecutar SQL | "Ejecuta: SELECT * FROM wines WHERE rating > 4" |
| Crear migraciones | "Añade una columna 'price' a la tabla wines" |
| Ver logs | "Muéstrame los logs de autenticación" |

---

## Parte B: Conectar GitHub (para push desde Kiro)

### Opción 1: Git nativo (recomendado)

Kiro ya puede ejecutar comandos git en la terminal. No necesitas MCP para esto. Simplemente dile:

> "Haz commit de los cambios y push a GitHub"

Kiro ejecutará:
```bash
git add .
git commit -m "descripción del cambio"
git push
```

Para que esto funcione, git debe estar autenticado. Verifica con:
```bash
git push  # si no pide contraseña, ya está configurado
```

Si pide contraseña, configura un credential helper:
```bash
# Windows (usa el Windows Credential Manager)
git config --global credential.helper manager

# La próxima vez que hagas push, ingresa tu PAT como contraseña
# Git lo recordará para siempre
```

### Opción 2: GitHub MCP Server (más funcionalidades)

Si quieres que Kiro pueda crear repos, PRs, issues, etc.:

Añade a tu `mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "...": "lo de antes"
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "TU_GITHUB_PAT"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Crear el GitHub PAT para MCP

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. "Generate new token"
3. Nombre: "Kiro MCP"
4. Repository access: "All repositories" (o selecciona los específicos)
5. Permissions:
   - Contents: Read and Write
   - Pull requests: Read and Write
   - Issues: Read and Write
   - Metadata: Read
6. "Generate token"
7. Copia y pega en el `mcp.json`

### ¿Qué puede hacer Kiro con GitHub MCP?

| Acción | Ejemplo |
|--------|---------|
| Crear repo | "Crea un repo privado llamado mi-web-vinos" |
| Push código | "Haz push de estos cambios" |
| Crear PR | "Crea un Pull Request con estos cambios" |
| Ver issues | "¿Qué issues abiertos hay?" |
| Crear branch | "Crea una branch 'feature/new-page'" |

---

## Parte C: Auto-Approve (opcional)

Si confías en que Kiro ejecute ciertas herramientas sin pedirte permiso cada vez:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["..."],
      "autoApprove": [
        "list_tables",
        "execute_sql",
        "list_extensions"
      ]
    }
  }
}
```

> ⚠️ No auto-apruebes `apply_migration` al principio. Es mejor que Kiro te pregunte antes de modificar la estructura de tu DB.

---

## Ejemplo Completo: mcp.json con Supabase + GitHub

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_xxxxxxxxxxxxxxxxxxxxx",
        "--project-ref",
        "abcdefghijk"
      ],
      "disabled": false,
      "autoApprove": ["list_tables", "execute_sql"]
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "github_pat_xxxxxxxxxxx"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

## Seguridad: ¿Es seguro poner tokens en mcp.json?

- El archivo `mcp.json` es **local** (no se sube a GitHub si tu `.gitignore` lo tiene)
- Añade a tu `.gitignore`:
  ```
  .kiro/settings/mcp.json
  ```
- O usa la versión global (`~/.kiro/settings/mcp.json`) que está fuera del repo

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| "Server disconnected" | Reinicia Kiro. Verifica que `npx` funciona en tu terminal |
| "Invalid access token" | Regenera el token en Supabase/GitHub |
| "Command not found: npx" | Instala Node.js (incluye npm/npx) |
| No aparece en el panel MCP | Verifica la ubicación del archivo. ¿Está en `.kiro/settings/mcp.json`? |
| "ENOENT" error | La ruta al comando `npx` no se encuentra. Verifica con `where npx` (Windows) |

---

## Siguiente paso

→ [06-deploy-workflow.md](./06-deploy-workflow.md) — Flujo completo de desarrollo y deploy
