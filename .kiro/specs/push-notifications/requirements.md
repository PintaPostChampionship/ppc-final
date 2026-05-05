# Requirements Document

## Introduction

El sistema de notificaciones push (Web Push Notifications) permite a los jugadores de PPC Tennis recibir alertas en tiempo real sobre eventos relevantes de sus partidos: cuando un rival agenda un partido, cuando se carga un resultado, y un recordatorio al día siguiente si el partido no fue registrado. Las notificaciones se envían exclusivamente vía Web Push API (VAPID) y se manejan a través del service worker existente (`public/sw.js`). Las suscripciones se almacenan en Supabase y el envío se realiza desde Vercel Functions. Los usuarios pueden optar por activar o desactivar las notificaciones desde la interfaz.

## Glossary

- **Push_System**: El sistema completo de notificaciones push descrito en este documento.
- **Service_Worker**: El archivo `public/sw.js` que intercepta eventos `push` y `notificationclick` del navegador.
- **Push_Subscription**: El objeto de suscripción del navegador (endpoint + keys) que permite enviar notificaciones a un dispositivo específico.
- **Subscription_Store**: La tabla `push_subscriptions` en Supabase que almacena las suscripciones activas de cada jugador.
- **Notification_Sender**: La Vercel Function `/api/send-notification` que envía notificaciones push usando la Web Push API con claves VAPID.
- **Reminder_Job**: El cron job (Vercel Cron o GitHub Action) que se ejecuta diariamente para enviar recordatorios post-partido.
- **VAPID_Keys**: Par de claves pública/privada usadas para autenticar el servidor ante el servicio push del navegador.
- **Current_Player**: El jugador autenticado actualmente en la plataforma.
- **Recipient_Player**: El jugador que recibe una notificación (distinto al que realizó la acción, excepto en recordatorios).
- **Match**: Un partido registrado en la tabla `matches` de Supabase.
- **Notification_Preferences**: La configuración del usuario sobre si desea recibir notificaciones push.
- **Permission_Prompt**: El diálogo nativo del navegador que solicita permiso para enviar notificaciones.

---

## Requirements

### Requirement 1: Almacenamiento de suscripciones push

**User Story:** Como jugador, quiero que mi dispositivo quede registrado para recibir notificaciones, para no perderme eventos importantes de mis partidos.

#### Acceptance Criteria

1. THE Subscription_Store SHALL almacenar cada Push_Subscription con los campos: `id`, `profile_id`, `endpoint`, `p256dh_key`, `auth_key`, `user_agent`, `created_at`, y `updated_at`.
2. WHEN el Current_Player otorga permiso de notificaciones y se obtiene una Push_Subscription del navegador, THE Push_System SHALL enviar la suscripción a una Vercel Function que la almacene en la Subscription_Store asociada al `profile_id` del Current_Player.
3. WHEN el Current_Player ya tiene una Push_Subscription almacenada con el mismo `endpoint`, THE Subscription_Store SHALL actualizar las claves (`p256dh_key`, `auth_key`) y el campo `updated_at` en lugar de crear un registro duplicado.
4. WHEN una Push_Subscription expira o el servicio push devuelve un error HTTP 410 (Gone), THE Notification_Sender SHALL eliminar esa suscripción de la Subscription_Store.
5. THE Subscription_Store SHALL permitir múltiples suscripciones por jugador (un registro por dispositivo/navegador).

---

### Requirement 2: Solicitud de permiso de notificaciones

**User Story:** Como jugador, quiero que la app me pida permiso para enviar notificaciones de forma clara y no intrusiva, para poder decidir si quiero recibirlas.

#### Acceptance Criteria

1. WHEN el Current_Player está autenticado y no ha otorgado ni denegado el permiso de notificaciones previamente, THE Push_System SHALL mostrar un banner o botón en la interfaz invitando al usuario a activar notificaciones.
2. WHEN el Current_Player presiona el botón de activar notificaciones, THE Push_System SHALL invocar el Permission_Prompt nativo del navegador.
3. WHEN el Permission_Prompt devuelve `granted`, THE Push_System SHALL registrar la Push_Subscription del navegador en la Subscription_Store y confirmar visualmente al usuario que las notificaciones están activas.
4. WHEN el Permission_Prompt devuelve `denied`, THE Push_System SHALL informar al usuario que las notificaciones están desactivadas y ocultar el banner de invitación.
5. WHEN el Permission_Prompt devuelve `default` (el usuario cierra el diálogo sin decidir), THE Push_System SHALL mantener el banner visible para futuros intentos.
6. THE Push_System SHALL verificar que el navegador soporta la API `PushManager` antes de mostrar cualquier opción de notificaciones.
7. WHEN el navegador no soporta `PushManager`, THE Push_System SHALL ocultar todas las opciones relacionadas con notificaciones push sin mostrar errores.

---

### Requirement 3: Opt-out y gestión de preferencias

**User Story:** Como jugador, quiero poder desactivar las notificaciones en cualquier momento, para controlar qué alertas recibo.

#### Acceptance Criteria

1. WHEN el Current_Player tiene notificaciones activas, THE Push_System SHALL mostrar un toggle o botón en la sección de perfil o configuración para desactivar notificaciones.
2. WHEN el Current_Player desactiva las notificaciones, THE Push_System SHALL cancelar la suscripción push del navegador (`pushSubscription.unsubscribe()`) y eliminar el registro correspondiente de la Subscription_Store.
3. WHEN el Current_Player reactiva las notificaciones después de haberlas desactivado, THE Push_System SHALL solicitar una nueva Push_Subscription al navegador y almacenarla en la Subscription_Store.
4. THE Push_System SHALL reflejar el estado actual de las notificaciones (activas/inactivas) de forma inmediata en la interfaz al cambiar la preferencia.

---

### Requirement 4: Notificación de partido agendado

**User Story:** Como jugador, quiero recibir una notificación cuando mi rival agenda un partido conmigo, para enterarme de la fecha, hora y lugar sin tener que revisar la app constantemente.

#### Acceptance Criteria

1. WHEN un Match cambia su estado a `scheduled` con ambos jugadores asignados (`home_player_id` y `away_player_id` no nulos), THE Push_System SHALL enviar una notificación al Recipient_Player (el jugador que NO realizó la acción de agendar).
2. THE Notification_Sender SHALL incluir en el cuerpo de la notificación: el nombre del rival, la fecha del partido, la hora (si está definida), y la ubicación (si está definida).
3. THE Notification_Sender SHALL incluir en la notificación una acción para agregar el partido al calendario (enlace a Google Calendar, Apple Calendar, o descarga de archivo .ics).
4. WHEN un Match es creado directamente con ambos jugadores asignados y estado `scheduled`, THE Push_System SHALL enviar la notificación al Recipient_Player.
5. WHEN un Match existente pasa de tener `away_player_id` nulo a tener un oponente asignado (con estado `scheduled`), THE Push_System SHALL enviar la notificación al jugador que ya estaba asignado previamente (`home_player_id`).
6. WHEN un Match ya tiene ambos jugadores asignados y solo se modifica la fecha, hora o ubicación, THE Push_System SHALL NOT enviar una notificación de "partido agendado" (evitar duplicados).
7. THE Notification_Sender SHALL enviar la notificación únicamente a los dispositivos del Recipient_Player que tengan suscripciones activas en la Subscription_Store.

---

### Requirement 5: Notificación de resultado cargado

**User Story:** Como jugador, quiero recibir una notificación cuando mi rival carga el resultado de nuestro partido, para poder revisarlo y editarlo si no estoy de acuerdo.

#### Acceptance Criteria

1. WHEN un Match cambia su estado a `played` (resultado cargado), THE Push_System SHALL enviar una notificación al Recipient_Player (el jugador que NO cargó el resultado).
2. THE Notification_Sender SHALL incluir en el cuerpo de la notificación: el resultado set por set (obtenido de `match_sets`), y quién ganó el partido.
3. THE Notification_Sender SHALL incluir en la notificación un enlace que abra la app en la vista del partido para que el Recipient_Player pueda revisar o editar el resultado.
4. WHEN la notificación es clickeada, THE Service_Worker SHALL abrir la app en la URL correspondiente a la vista del partido (o la vista de la división donde se jugó).
5. THE Push_System SHALL identificar al jugador que cargó el resultado usando el campo `created_by` del Match para determinar quién es el Recipient_Player.

---

### Requirement 6: Recordatorio post-partido

**User Story:** Como jugador, quiero recibir un recordatorio al día siguiente de un partido programado si no se cargó el resultado, para no olvidar registrarlo o reagendarlo.

#### Acceptance Criteria

1. THE Reminder_Job SHALL ejecutarse una vez al día (preferiblemente entre 10:00 y 12:00 hora de Londres).
2. WHEN el Reminder_Job se ejecuta, THE Reminder_Job SHALL identificar todos los partidos cuya fecha (`date`) sea el día anterior y cuyo estado siga siendo `scheduled` (no `played` ni `cancelled`).
3. FOR EACH partido identificado, THE Reminder_Job SHALL enviar una notificación a AMBOS jugadores del partido (tanto `home_player_id` como `away_player_id`).
4. THE Notification_Sender SHALL incluir en el cuerpo del recordatorio el texto: "¿Se jugó el partido? Recuerda agregar el resultado o reagendarlo" junto con el nombre del rival.
5. THE Reminder_Job SHALL enviar el recordatorio una única vez por partido; partidos que ya recibieron un recordatorio no recibirán otro en ejecuciones posteriores del cron.
6. WHEN la notificación de recordatorio es clickeada, THE Service_Worker SHALL abrir la app en la vista del partido correspondiente.
7. THE Reminder_Job SHALL ignorar partidos donde `away_player_id` es nulo (partidos sin oponente asignado).

---

### Requirement 7: Service Worker — manejo de eventos push

**User Story:** Como jugador, quiero que las notificaciones se muestren correctamente en mi dispositivo incluso si la app no está abierta, para no perder ninguna alerta.

#### Acceptance Criteria

1. WHEN el Service_Worker recibe un evento `push`, THE Service_Worker SHALL parsear el payload JSON y mostrar una notificación del sistema con el título, cuerpo, ícono y datos de acción incluidos en el payload.
2. WHEN el Service_Worker recibe un evento `push` con un payload que no puede parsearse como JSON válido, THE Service_Worker SHALL mostrar una notificación genérica con el título "PPC Tennis" y el texto del payload como cuerpo.
3. WHEN el usuario hace click en una notificación (`notificationclick`), THE Service_Worker SHALL abrir la URL especificada en el campo `data.url` del payload de la notificación.
4. WHEN el usuario hace click en una notificación y la app ya está abierta en una pestaña, THE Service_Worker SHALL enfocar esa pestaña y navegar a la URL especificada en lugar de abrir una nueva pestaña.
5. THE Service_Worker SHALL mostrar el ícono de la app (`/android-chrome-192x192.png`) en todas las notificaciones push.
6. THE Service_Worker SHALL incluir el badge `/favicon-dark.png` en las notificaciones para dispositivos que lo soporten.

---

### Requirement 8: Vercel Function para envío de notificaciones

**User Story:** Como sistema, quiero un endpoint centralizado para enviar notificaciones push, para que tanto el frontend como el cron job puedan disparar notificaciones de forma segura.

#### Acceptance Criteria

1. THE Notification_Sender SHALL exponerse como Vercel Function en la ruta `/api/send-notification`.
2. THE Notification_Sender SHALL aceptar un payload con los campos: `recipient_profile_id` (uuid), `title` (string), `body` (string), `url` (string), y opcionalmente `actions` (array de objetos con `action` y `title`).
3. WHEN el Notification_Sender recibe una solicitud válida, THE Notification_Sender SHALL consultar la Subscription_Store para obtener todas las suscripciones activas del `recipient_profile_id` y enviar la notificación a cada una usando la Web Push API con las VAPID_Keys.
4. IF una suscripción devuelve un error HTTP 410 (Gone) o HTTP 404, THEN THE Notification_Sender SHALL eliminar esa suscripción de la Subscription_Store y continuar con las demás.
5. THE Notification_Sender SHALL autenticar las solicitudes entrantes para evitar envíos no autorizados (validar que la solicitud proviene del frontend autenticado o del cron job con un secret compartido).
6. THE Notification_Sender SHALL leer las VAPID_Keys desde variables de entorno del servidor (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
7. IF las VAPID_Keys no están configuradas, THEN THE Notification_Sender SHALL devolver un error HTTP 500 sin exponer detalles de configuración al cliente.

---

### Requirement 9: Compatibilidad con navegadores móviles

**User Story:** Como jugador, quiero recibir notificaciones push en mi teléfono móvil, ya que es el dispositivo principal con el que uso la app.

#### Acceptance Criteria

1. THE Push_System SHALL funcionar en Chrome para Android (versión 50+).
2. THE Push_System SHALL funcionar en Safari para iOS (versión 16.4+, que soporta Web Push para PWAs instaladas).
3. WHEN el navegador no soporta la Push API o el Service Worker API, THE Push_System SHALL degradar gracefully ocultando todas las opciones de notificaciones sin afectar el resto de la funcionalidad.
4. THE Service_Worker SHALL registrarse correctamente tanto en contexto de navegador como en contexto de PWA instalada (standalone).
5. THE Push_System SHALL utilizar la clave pública VAPID (`applicationServerKey`) al crear la Push_Subscription para garantizar compatibilidad con todos los servicios push (FCM, APNs, Mozilla Push Service).

---

### Requirement 10: Payload de notificación y acción de calendario

**User Story:** Como jugador, quiero poder agregar un partido a mi calendario directamente desde la notificación, para no tener que copiar los datos manualmente.

#### Acceptance Criteria

1. WHEN la notificación de "partido agendado" incluye una acción de calendario, THE Notification_Sender SHALL generar un enlace de Google Calendar con los campos: título ("PPC: [Rival Name]"), fecha, hora de inicio, hora de fin (1 hora después del inicio por defecto), y ubicación.
2. THE Notification_Sender SHALL incluir como acción alternativa un enlace para descargar un archivo .ics con los mismos datos del evento.
3. WHEN el usuario hace click en la acción de calendario de la notificación, THE Service_Worker SHALL abrir el enlace de Google Calendar en una nueva pestaña del navegador.
4. WHEN la hora del partido no está definida en el Match, THE Notification_Sender SHALL omitir la acción de calendario y enviar la notificación solo con el enlace a la app.

---

### Requirement 11: Tracking de recordatorios enviados

**User Story:** Como sistema, quiero registrar qué recordatorios ya se enviaron, para no enviar duplicados al ejecutar el cron job diariamente.

#### Acceptance Criteria

1. THE Reminder_Job SHALL mantener un registro de los partidos para los cuales ya se envió un recordatorio, usando un campo `reminder_sent` (boolean) en la tabla `matches` o una tabla auxiliar `push_notification_log`.
2. WHEN el Reminder_Job identifica un partido elegible para recordatorio, THE Reminder_Job SHALL verificar que no se haya enviado un recordatorio previo para ese partido antes de enviar la notificación.
3. WHEN el Reminder_Job envía un recordatorio exitosamente para un partido, THE Reminder_Job SHALL marcar ese partido como "recordatorio enviado" para evitar reenvíos en ejecuciones futuras.
4. IF el envío del recordatorio falla para un partido, THEN THE Reminder_Job SHALL NOT marcar ese partido como "recordatorio enviado", permitiendo un reintento en la siguiente ejecución.

---

## Future Notifications (fuera de alcance)

Las siguientes notificaciones están planificadas para futuras iteraciones pero NO forman parte de este spec:

- **Partido sin oponente**: "Hay un partido sin rival, ¿quieres unirte?" — notificar a jugadores de la misma división.
- **Recordatorio de pago**: Notificar a jugadores con cuota pendiente antes de la fecha límite.
- **Eventos sociales**: Notificar sobre cenas, celebraciones y eventos del PPC.
- **Partido en vivo**: Notificar cuando un partido del Live Scoreboard comienza.
- **Final de torneo**: Notificar que se acerca la final o semifinal de un torneo.
- **Inscripción abierta**: Notificar cuando se abre la inscripción para un nuevo torneo.
