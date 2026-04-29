# Implementation Plan: Fee Payment Tracking

## Overview

Implementación incremental del sistema de seguimiento de cuotas de torneo. Se construye de afuera hacia adentro: primero las funciones puras y tipos compartidos, luego la Vercel Function del servidor, luego el hook de React, y finalmente la integración en la Division_Table con el modal de confirmación. Cada paso queda integrado antes de pasar al siguiente.

## Tasks

- [x] 1. Instalar dependencias y crear estructura de archivos
  - Instalar `fast-check` como devDependency: `npm install --save-dev fast-check@^3.22.0`
  - Instalar `vitest` y `@vitest/ui` como devDependencies para los tests: `npm install --save-dev vitest@^2.0.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.0.0 jsdom@^25.0.0`
  - Crear el directorio `api/` en la raíz del proyecto (`ppc-final/api/`)
  - Crear el directorio `api/__tests__/` para los tests de la Vercel Function
  - Crear el directorio `src/__tests__/` para los tests del frontend
  - Crear el archivo `src/hooks/usePaymentStatus.ts` (vacío por ahora)
  - Crear el archivo `src/components/PaymentStatusIcon.tsx` (vacío por ahora)
  - Crear el archivo `src/components/PaymentModal.tsx` (vacío por ahora)
  - Crear el archivo `api/sheets-update.ts` (vacío por ahora)
  - Actualizar `vite.config.ts` para añadir la configuración de Vitest (`test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] }`)
  - Crear `src/test-setup.ts` con `import '@testing-library/jest-dom'`
  - _Requirements: 1.1, 6.1_

- [x] 2. Implementar tipos compartidos y funciones puras de parseo/filtrado
  - [x] 2.1 Crear `src/types/payment.ts` con los tipos TypeScript del dominio
    - Definir `type PaymentStatus = 'pendiente' | 'pagado_sin_validar' | 'pagado'`
    - Definir `type PaymentStatusMap = Map<string, PaymentStatus>`
    - Definir `interface PagosWebRow { profile_id, nombre, division, torneo, estado, fecha_autoreporte, fecha_validacion }`
    - _Requirements: 1.2, 2.1, 2.2_

  - [x] 2.2 Crear `src/lib/paymentUtils.ts` con las funciones puras exportables
    - Implementar `parseGvizResponse(raw: string): PagosWebRow[]` — extrae el JSON del wrapper `google.visualization.Query.setResponse(...)` con regex, mapea columnas por índice (orden conocido: profile_id, nombre, division, torneo, estado, fecha_autoreporte, fecha_validacion), devuelve array vacío en caso de error
    - Implementar `buildPaymentMap(rows: PagosWebRow[], activeTorneo: string): PaymentStatusMap` — filtra por `torneo === activeTorneo` y construye el Map
    - Implementar `getPaymentIcon(profileId: string, map: PaymentStatusMap): '💰' | '✅' | null` — devuelve el ícono según el estado o null si no hay entrada
    - Implementar `countYaPaguéButtons(playerIds: string[], currentUserId: string | null | undefined, map: PaymentStatusMap): number` — cuenta cuántos botones "Ya pagué" se renderizarían
    - _Requirements: 1.2, 1.5, 2.1, 2.2, 2.3_

  - [ ]* 2.3 Escribir property test — Property 1: Filtrado de pagos por torneo
    - Archivo: `src/__tests__/paymentUtils.test.ts`
    - **Property 1: Filtrado de pagos por torneo**
    - **Validates: Requirements 1.2, 1.5**
    - El mapa resultante de `buildPaymentMap` solo contiene entradas cuyo `torneo` coincide exactamente con el torneo buscado
    - Tag: `// Feature: fee-payment-tracking, Property 1: filtrado por torneo`

  - [ ]* 2.4 Escribir property test — Property 2: Íconos de estado correctos
    - Archivo: `src/__tests__/paymentUtils.test.ts`
    - **Property 2: Íconos de estado de pago son correctos y completos**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Para cualquier lista de jugadores y cualquier `PaymentStatusMap`, `getPaymentIcon` asigna `💰` a `pendiente`, `✅` a `pagado_sin_validar` o `pagado`, y `null` a jugadores sin entrada
    - Tag: `// Feature: fee-payment-tracking, Property 2: íconos de estado de pago`

- [ ] 3. Checkpoint — Verificar funciones puras
  - Asegurarse de que todos los tests de `paymentUtils.test.ts` pasan. Preguntar al usuario si hay dudas.

- [x] 4. Implementar funciones puras del servidor (lógica de negocio de la Vercel Function)
  - [x] 4.1 Crear `api/lib/sheetsLogic.ts` con las funciones puras del servidor
    - Implementar `validateStateTransition(currentStatus: string): { allowed: boolean }` — solo permite `pendiente` → `pagado_sin_validar`
    - Implementar `validateProfileExists(rows: Array<{ profile_id: string; torneo: string }>, profileId: string, torneo: string): { valid: boolean }` — verifica que existe una fila con ese `profile_id` y `torneo`
    - Implementar `findRow<T extends { profile_id: string; torneo: string }>(rows: T[], profileId: string, torneo: string): T | undefined` — busca la fila correcta por `profile_id` AND `torneo`
    - _Requirements: 6.3, 6.4, 5.6_

  - [ ]* 4.2 Escribir property test — Property 4: Solo transición pendiente → pagado_sin_validar
    - Archivo: `api/__tests__/sheetsLogic.test.ts`
    - **Property 4: La Vercel Function solo permite la transición pendiente → pagado_sin_validar**
    - **Validates: Requirements 6.4**
    - Para cualquier estado de entrada, `validateStateTransition` devuelve `allowed: true` solo cuando el estado es `pendiente`
    - Tag: `// Feature: fee-payment-tracking, Property 4: transición de estado válida`

  - [ ]* 4.3 Escribir property test — Property 5: Validación de profile_id existente
    - Archivo: `api/__tests__/sheetsLogic.test.ts`
    - **Property 5: La Vercel Function valida la existencia del profile_id**
    - **Validates: Requirements 6.3**
    - Para cualquier array de filas y cualquier `profile_id` + `torneo`, `validateProfileExists` devuelve `valid: true` si y solo si existe una fila con esa combinación exacta
    - Tag: `// Feature: fee-payment-tracking, Property 5: validación de profile_id`

  - [ ]* 4.4 Escribir property test — Property 6: Lookup correcto por profile_id + torneo
    - Archivo: `api/__tests__/sheetsLogic.test.ts`
    - **Property 6: El lookup de fila es correcto para cualquier combinación profile_id + torneo**
    - **Validates: Requirements 5.6**
    - Para cualquier array de filas con al menos un elemento, `findRow` identifica correctamente la fila cuyo `profile_id` Y `torneo` coinciden, sin confundir filas de distintos torneos para el mismo jugador
    - Tag: `// Feature: fee-payment-tracking, Property 6: lookup de fila por profile_id y torneo`

- [x] 5. Implementar la Vercel Function `api/sheets-update.ts`
  - [x] 5.1 Implementar el handler principal de la Vercel Function
    - Importar `sheetsLogic.ts` para las validaciones
    - Validar que el body contiene `profile_id` y `torneo`; devolver HTTP 400 si faltan
    - Leer `GOOGLE_SERVICE_ACCOUNT_JSON` del entorno (`process.env`); devolver HTTP 500 si no existe
    - Generar JWT RSA-SHA256 con la Service Account (reutilizar el patrón ya validado en el proyecto — ver otros archivos en `api/` si existen, o implementar el flujo estándar de Google OAuth2 con `crypto.subtle`)
    - Obtener access token de Google OAuth2 (`https://oauth2.googleapis.com/token`)
    - Leer la hoja `pagos_web` completa via Google Sheets API v4 (`spreadsheets.values.get`)
    - Usar `findRow` para localizar la fila con `profile_id` y `torneo` coincidentes; devolver HTTP 400 si no existe
    - Usar `validateStateTransition` para verificar que el estado actual es `pendiente`; devolver HTTP 400 si no lo es
    - Actualizar la fila con `estado = pagado_sin_validar` y `fecha_autoreporte = new Date().toISOString()` via `spreadsheets.values.update`
    - Devolver HTTP 200 `{ success: true }` en caso de éxito
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 5.2 Escribir unit tests para la Vercel Function
    - Archivo: `api/__tests__/sheets-update.test.ts`
    - Test: devuelve HTTP 400 cuando el body no contiene `profile_id` o `torneo`
    - Test: devuelve HTTP 500 cuando `GOOGLE_SERVICE_ACCOUNT_JSON` no está configurado
    - _Requirements: 6.2, 6.5_

- [ ] 6. Checkpoint — Verificar lógica del servidor
  - Asegurarse de que todos los tests de `sheetsLogic.test.ts` y `sheets-update.test.ts` pasan. Preguntar al usuario si hay dudas.

- [x] 7. Implementar el hook `usePaymentStatus`
  - [x] 7.1 Implementar `src/hooks/usePaymentStatus.ts`
    - Definir la interfaz `UsePaymentStatusResult` con `{ paymentMap, loading, error, reportPayment, reporting, reportError }`
    - Al montar (cuando `torneoName` no es null), hacer `fetch` al gviz endpoint: `https://docs.google.com/spreadsheets/d/1DC64PmiKF7yerp59-PT0fnEGcU0xSW7Dm500PyBtJWg/gviz/tq?tqx=out:json&sheet=pagos_web`
    - Usar `parseGvizResponse` y `buildPaymentMap` de `paymentUtils.ts` para construir el mapa
    - Si el fetch falla o el parseo falla, dejar `paymentMap` vacío y setear `error`; nunca bloquear el render de la tabla
    - Implementar `reportPayment(profileId: string, torneo: string): Promise<void>` que hace `POST /api/sheets-update` con `{ profile_id: profileId, torneo }`
    - Tras respuesta exitosa, actualizar el estado local del jugador a `pagado_sin_validar` (actualización optimista)
    - Si la respuesta es error, setear `reportError` sin cambiar el estado local
    - Gestionar `reporting: boolean` para deshabilitar el botón durante la solicitud
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.3, 5.4, 5.5_

  - [ ]* 7.2 Escribir unit tests para `usePaymentStatus`
    - Archivo: `src/__tests__/paymentStatus.test.ts`
    - Test: actualiza el estado local a `pagado_sin_validar` tras respuesta exitosa del POST
    - Test: muestra `reportError` y no cambia el estado local tras respuesta de error del POST
    - Test: `paymentMap` queda vacío y no bloquea el render cuando el gviz fetch falla
    - _Requirements: 1.3, 5.3, 5.4_

- [x] 8. Implementar los componentes `PaymentStatusIcon` y `PaymentModal`
  - [x] 8.1 Implementar `src/components/PaymentStatusIcon.tsx`
    - Recibe `{ status: PaymentStatus | undefined }`
    - Renderiza `💰` si `status === 'pendiente'`
    - Renderiza `✅` si `status === 'pagado_sin_validar'` o `status === 'pagado'`
    - Renderiza `null` si `status` es `undefined`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 8.2 Escribir property test — Property 3: Botón "Ya pagué" aparece como máximo una vez
    - Archivo: `src/__tests__/paymentStatus.test.ts`
    - **Property 3: El botón "Ya pagué" aparece como máximo una vez**
    - **Validates: Requirements 3.1, 3.4**
    - Para cualquier lista de jugadores, cualquier `currentUserId`, y cualquier `PaymentStatusMap`, `countYaPaguéButtons` devuelve siempre 0 o 1, nunca más de uno
    - Tag: `// Feature: fee-payment-tracking, Property 3: unicidad del botón Ya pagué`

  - [x] 8.3 Implementar `src/components/PaymentModal.tsx`
    - Recibe `{ isOpen, onConfirm, onCancel, isSubmitting, error }`
    - Renderiza `null` si `isOpen` es `false`
    - Muestra el texto: "¿Estás seguro que pagaste a la cuenta de Daniel Sepulveda? Account number: 71906880 Sort code: 23-08-01"
    - Muestra los botones "Sí, pagué" y "Cancelar"
    - El botón "Sí, pagué" se deshabilita cuando `isSubmitting` es `true`
    - Muestra `error` si no es null
    - Usa estilos Tailwind CSS consistentes con los modales existentes: fondo oscuro semitransparente (`fixed inset-0 bg-black/60 z-50 flex items-center justify-center`), tarjeta centrada con bordes redondeados (`bg-white rounded-2xl p-6 max-w-sm w-full mx-4`)
    - Bloquea la interacción con el resto de la interfaz (overlay con `z-50`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.5, 8.2_

  - [ ]* 8.4 Escribir unit tests para `PaymentModal`
    - Archivo: `src/__tests__/paymentModal.test.tsx`
    - Test: renderiza con los datos bancarios correctos (nombre, account number, sort code)
    - Test: llama `onCancel` al presionar "Cancelar" sin hacer fetch
    - Test: el botón "Sí, pagué" está deshabilitado cuando `isSubmitting` es `true`
    - _Requirements: 4.1, 4.2, 4.3, 5.5_

- [x] 9. Integrar en la Division_Table de `App.tsx`
  - [x] 9.1 Añadir el hook `usePaymentStatus` en el componente que renderiza la Division_Table
    - Localizar el bloque de la Division_Table en `App.tsx` (alrededor de las líneas 11750–11830)
    - Identificar la variable que contiene el nombre del torneo activo (para pasarla como `torneoName` al hook)
    - Añadir `const { paymentMap, reportPayment, reporting, reportError } = usePaymentStatus(torneoName)` en el scope correcto
    - Añadir el estado local `const [paymentModalOpen, setPaymentModalOpen] = useState(false)` para controlar el modal
    - _Requirements: 1.1, 1.4_

  - [x] 9.2 Modificar el `<thead>` de la Division_Table para añadir la columna de pago
    - Añadir un `<th>` vacío (o con un ícono 💳 como header) a la izquierda de la columna de posición `#`
    - Mantener el diseño responsivo existente (la columna puede ser `w-8` o similar)
    - _Requirements: 2.1, 2.4, 8.1, 8.3_

  - [x] 9.3 Modificar cada `<tr>` del `rosterSorted.map(...)` para añadir la celda de pago
    - Añadir una `<td>` a la izquierda de la celda de posición en cada fila
    - Dentro de la `<td>`, renderizar `<PaymentStatusIcon status={paymentMap.get(player.profile_id)} />`
    - Si `player.profile_id === currentUser?.id` y `paymentMap.get(player.profile_id) === 'pendiente'`, renderizar también el botón "Ya pagué" que llama a `setPaymentModalOpen(true)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 9.4 Añadir el `<PaymentModal>` al final del JSX de la Division_Table
    - Renderizar `<PaymentModal isOpen={paymentModalOpen} onConfirm={handleConfirmPayment} onCancel={() => setPaymentModalOpen(false)} isSubmitting={reporting} error={reportError} />`
    - Implementar `handleConfirmPayment`: llama a `reportPayment(currentUser.id, torneoName)` y cierra el modal al completarse
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.5_

  - [ ]* 9.5 Escribir unit tests para la Division_Table con íconos de pago
    - Archivo: `src/__tests__/divisionTable.test.tsx`
    - Test: renderiza sin íconos cuando `paymentMap` está vacío (error de fetch)
    - Test: muestra el botón "Ya pagué" solo en la fila del jugador autenticado con estado `pendiente`
    - Test: no muestra el botón "Ya pagué" cuando el jugador no está autenticado
    - _Requirements: 1.3, 3.1, 3.2_

- [ ] 10. Checkpoint final — Verificar integración completa
  - Ejecutar todos los tests: `npx vitest --run`
  - Asegurarse de que todos los tests pasan (unit tests y property tests)
  - Verificar que la Division_Table renderiza correctamente con y sin datos de pago
  - Preguntar al usuario si hay dudas antes de dar por completada la implementación.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- fast-check no está en devDependencies todavía — la tarea 1 lo instala
- Vitest tampoco está configurado — la tarea 1 también lo configura
- El directorio `api/` no existe aún — la tarea 1 lo crea
- Cada tarea referencia requisitos específicos para trazabilidad
- Los property tests usan mínimo 100 iteraciones (comportamiento por defecto de fast-check)
- La Vercel Function usa el patrón JWT RSA-SHA256 con `crypto.subtle` (disponible en Node 18+, que es el runtime de Vercel)
- El estado optimista en `usePaymentStatus` evita un re-fetch al sheet tras cada autoreporte
- La Division_Table nunca bloquea su render esperando los datos de pago (loading independiente)
