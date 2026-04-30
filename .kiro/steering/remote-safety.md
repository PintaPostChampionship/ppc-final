# Reglas de seguridad para ejecución remota (Kiro headless)

## Base de datos (Supabase)

- **NUNCA borrar tablas, columnas ni datos existentes** (DROP TABLE, DROP COLUMN, DELETE FROM sin WHERE están prohibidos)
- **NUNCA modificar RLS policies** sin instrucción explícita del usuario
- Para consultas de lectura (SELECT), proceder libremente
- Para INSERT/UPDATE, verificar que los datos son coherentes antes de ejecutar
- Si el prompt pide algo destructivo, responder explicando el riesgo y NO ejecutar

## Código (ppc-final — web React + TypeScript)

- Antes de modificar un archivo, leer su contenido actual completo
- No borrar archivos ni componentes existentes
- **Asegurarse de no romper nada**: verificar imports, tipos, y dependencias antes de hacer cambios finales
- No tocar archivos de configuración sensibles (`.env.local`, `vite.config.ts`, `tailwind.config.js`) sin instrucción explícita
- No modificar los workflows de GitHub Actions a menos que el prompt lo pida explícitamente
- Si un cambio afecta múltiples componentes, explicar el impacto antes de proceder

## Flujo de trabajo

- Preferir cambios pequeños y seguros sobre refactors grandes
- Si el prompt es ambiguo, hacer la interpretación más conservadora
- Siempre explicar qué se hizo y por qué en el output
