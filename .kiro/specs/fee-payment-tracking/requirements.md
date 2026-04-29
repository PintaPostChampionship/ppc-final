# Requirements Document

## Introduction

El sistema de gestión de cuotas de torneo (fee payment tracking) permite a los jugadores de PPC Tennis reportar el pago de su cuota de inscripción directamente desde la vista de división, y al encargado de finanzas validar dichos pagos en Google Sheets. La fuente de verdad es la hoja `pagos_web` de Google Sheets, que se lee públicamente vía endpoint gviz y se escribe de forma segura a través de una Vercel Function con Service Account. El flujo cubre tres estados: `pendiente`, `pagado_sin_validar` y `pagado`.

## Glossary

- **Fee_Tracker**: El sistema de seguimiento de cuotas de torneo descrito en este documento.
- **Payment_Status**: El estado del pago de un jugador. Valores posibles: `pendiente`, `pagado_sin_validar`, `pagado`.
- **Sheets_Reader**: El módulo del frontend que lee la hoja `pagos_web` vía endpoint público gviz de Google Sheets.
- **Sheets_Writer**: La Vercel Function (`/api/sheets-update`) que escribe en la hoja `pagos_web` usando la Service Account del servidor.
- **Division_Table**: La tabla de clasificación de una división visible en la vista de torneo de la plataforma PPC Tennis.
- **Payment_Modal**: El modal de confirmación que aparece cuando un jugador presiona "Ya pagué".
- **Current_Player**: El jugador autenticado actualmente en la plataforma.
- **Finance_Manager**: El encargado de finanzas que valida pagos directamente en Google Sheets.
- **pagos_web**: Hoja de Google Sheets con columnas `profile_id | nombre | division | torneo | estado | fecha_autoreporte | fecha_validacion`.
- **gviz_endpoint**: URL pública de Google Sheets para lectura sin credenciales: `https://docs.google.com/spreadsheets/d/1DC64PmiKF7yerp59-PT0fnEGcU0xSW7Dm500PyBtJWg/gviz/tq?tqx=out:json&sheet=pagos_web`.
- **Service_Account**: Cuenta de servicio de Google configurada en la variable de entorno `GOOGLE_SERVICE_ACCOUNT_JSON`, usada exclusivamente por la Vercel Function para escritura.

---

## Requirements

### Requirement 1: Lectura del estado de pagos desde Google Sheets

**User Story:** Como jugador, quiero que la plataforma muestre el estado de mi cuota de torneo al cargar la vista de división, para saber si debo realizar el pago.

#### Acceptance Criteria

1. WHEN un usuario navega a la vista de una división, THE Sheets_Reader SHALL obtener los datos de la hoja `pagos_web` vía el gviz_endpoint sin requerir credenciales del cliente.
2. WHEN la respuesta del gviz_endpoint es recibida, THE Sheets_Reader SHALL parsear el JSON de respuesta y construir un mapa de `profile_id` → `Payment_Status` para todos los jugadores de esa división y torneo.
3. IF el gviz_endpoint no responde o devuelve un error, THEN THE Fee_Tracker SHALL mostrar la Division_Table sin íconos de estado de pago y sin interrumpir la visualización de la tabla.
4. WHILE los datos de pago están siendo cargados, THE Fee_Tracker SHALL mostrar la Division_Table en su estado normal sin bloquear la interfaz.
5. THE Sheets_Reader SHALL filtrar los registros de `pagos_web` por el campo `torneo` correspondiente al torneo activo que se está visualizando.

---

### Requirement 2: Visualización del estado de pago en la tabla de división

**User Story:** Como jugador, quiero ver un indicador visual del estado de pago en la tabla de división, para saber quién ha pagado y quién no.

#### Acceptance Criteria

1. WHEN el Payment_Status de un jugador es `pendiente`, THE Division_Table SHALL mostrar el ícono 💰 a la izquierda de la columna de posición (#) en la fila de ese jugador.
2. WHEN el Payment_Status de un jugador es `pagado_sin_validar` o `pagado`, THE Division_Table SHALL mostrar el ícono ✅ a la izquierda de la columna de posición (#) en la fila de ese jugador.
3. WHEN un jugador no tiene registro en `pagos_web` para el torneo activo, THE Division_Table SHALL omitir el ícono de estado de pago en la fila de ese jugador.
4. THE Division_Table SHALL mostrar los íconos de estado de pago para todos los jugadores registrados en la división, independientemente de si el Current_Player está autenticado.

---

### Requirement 3: Botón "Ya pagué" para el jugador autenticado

**User Story:** Como jugador, quiero poder reportar mi pago directamente desde la tabla de división, para notificar al encargado de finanzas sin salir de la plataforma.

#### Acceptance Criteria

1. WHEN el Current_Player está autenticado y su Payment_Status es `pendiente`, THE Division_Table SHALL mostrar el botón "Ya pagué" únicamente en la fila correspondiente al Current_Player.
2. WHEN el Current_Player no está autenticado, THE Division_Table SHALL omitir el botón "Ya pagué" en todas las filas.
3. WHEN el Payment_Status del Current_Player es `pagado_sin_validar` o `pagado`, THE Division_Table SHALL omitir el botón "Ya pagué" en la fila del Current_Player.
4. THE Division_Table SHALL mostrar el botón "Ya pagué" en una sola fila como máximo, correspondiente exclusivamente al Current_Player.

---

### Requirement 4: Modal de confirmación de pago

**User Story:** Como jugador, quiero confirmar mi pago antes de enviarlo, para evitar reportes accidentales y conocer los datos bancarios del destinatario.

#### Acceptance Criteria

1. WHEN el Current_Player presiona el botón "Ya pagué", THE Payment_Modal SHALL abrirse mostrando el texto: "¿Estás seguro que pagaste a la cuenta de Daniel Sepulveda? Account number: 71906880 Sort code: 23-08-01".
2. THE Payment_Modal SHALL mostrar dos botones: "Sí, pagué" y "Cancelar".
3. WHEN el Current_Player presiona "Cancelar" en el Payment_Modal, THE Payment_Modal SHALL cerrarse sin realizar ninguna acción ni cambio de estado.
4. WHEN el Payment_Modal está abierto, THE Fee_Tracker SHALL impedir la interacción con el resto de la interfaz hasta que el usuario presione "Sí, pagué" o "Cancelar".
5. THE Payment_Modal SHALL mostrar los datos bancarios hardcodeados: nombre "Daniel Sepulveda", account number "71906880", sort code "23-08-01".

---

### Requirement 5: Registro del autoreporte de pago

**User Story:** Como jugador, quiero que mi confirmación de pago quede registrada en el sistema, para que el encargado de finanzas pueda validarla.

#### Acceptance Criteria

1. WHEN el Current_Player presiona "Sí, pagué" en el Payment_Modal, THE Sheets_Writer SHALL enviar una solicitud a la Vercel Function `/api/sheets-update` con el `profile_id` del Current_Player, el estado `pagado_sin_validar` y el timestamp actual como `fecha_autoreporte`.
2. WHEN la Vercel Function recibe la solicitud, THE Sheets_Writer SHALL actualizar la fila correspondiente en `pagos_web` usando la Service_Account, estableciendo `estado = pagado_sin_validar` y `fecha_autoreporte = timestamp ISO 8601`.
3. WHEN la actualización en Google Sheets es exitosa, THE Fee_Tracker SHALL actualizar el estado local del Current_Player a `pagado_sin_validar`, ocultando el ícono 💰 y el botón "Ya pagué" en su fila.
4. IF la Vercel Function devuelve un error, THEN THE Fee_Tracker SHALL mostrar un mensaje de error al Current_Player indicando que el registro no pudo completarse, sin cambiar el estado local.
5. WHILE la solicitud a la Vercel Function está en curso, THE Payment_Modal SHALL deshabilitar el botón "Sí, pagué" para evitar envíos duplicados.
6. THE Sheets_Writer SHALL identificar la fila a actualizar en `pagos_web` usando el campo `profile_id` del Current_Player y el campo `torneo` del torneo activo.

---

### Requirement 6: Seguridad de la escritura en Google Sheets

**User Story:** Como administrador del sistema, quiero que la escritura en Google Sheets solo ocurra a través del servidor, para proteger las credenciales de la Service Account.

#### Acceptance Criteria

1. THE Sheets_Writer SHALL ejecutarse exclusivamente como Vercel Function en el servidor, sin exponer la Service_Account al cliente.
2. THE Sheets_Writer SHALL leer las credenciales de la Service_Account únicamente desde la variable de entorno `GOOGLE_SERVICE_ACCOUNT_JSON` del servidor.
3. WHEN la Vercel Function recibe una solicitud de actualización, THE Sheets_Writer SHALL validar que el `profile_id` recibido corresponde a un jugador registrado en `pagos_web` antes de realizar la escritura.
4. THE Sheets_Writer SHALL permitir únicamente la transición de estado `pendiente` → `pagado_sin_validar` desde el cliente; cualquier otra transición de estado SHALL ser rechazada con un error HTTP 400.
5. IF la variable de entorno `GOOGLE_SERVICE_ACCOUNT_JSON` no está configurada en el servidor, THEN THE Sheets_Writer SHALL devolver un error HTTP 500 sin exponer detalles de la configuración al cliente.

---

### Requirement 7: Validación por el encargado de finanzas

**User Story:** Como encargado de finanzas, quiero poder validar o revertir pagos directamente en Google Sheets, para mantener el control sobre el estado final de cada cuota.

#### Acceptance Criteria

1. THE Finance_Manager SHALL poder cambiar el estado de cualquier fila en `pagos_web` directamente en Google Sheets sin intervención de la plataforma web.
2. WHEN el Finance_Manager cambia el estado de una fila a `pagado` en Google Sheets, THE Sheets_Reader SHALL reflejar ese cambio la próxima vez que un usuario cargue la vista de la división correspondiente.
3. WHEN el Finance_Manager revierte el estado de una fila a `pendiente` en Google Sheets, THE Sheets_Reader SHALL reflejar ese cambio la próxima vez que un usuario cargue la vista de la división correspondiente.
4. THE Fee_Tracker SHALL NOT proveer ninguna interfaz web para que el Finance_Manager valide pagos; la validación ocurre exclusivamente en Google Sheets.

---

### Requirement 8: Consistencia visual con el diseño existente

**User Story:** Como jugador, quiero que los elementos de seguimiento de cuotas se integren visualmente con el diseño actual de la plataforma, para una experiencia coherente.

#### Acceptance Criteria

1. THE Division_Table SHALL mostrar los íconos de estado de pago (💰 y ✅) en una columna adicional a la izquierda de la columna de posición (#), sin desplazar ni alterar las columnas existentes.
2. THE Payment_Modal SHALL utilizar los estilos de Tailwind CSS consistentes con los modales existentes en la plataforma (fondo oscuro semitransparente, tarjeta centrada con bordes redondeados).
3. THE Fee_Tracker SHALL mantener el diseño responsivo existente de la Division_Table en dispositivos móviles y de escritorio.
