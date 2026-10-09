# Ventanas de reserva por cancha (booking windows)

> Objetivo: mostrar en la web (popup del pin + panel) cuántos días antes se puede
> reservar cada cancha, distinguiendo **con membresía** vs **sin membresía**.
>
> Rellena las columnas `T+N sin membresía` y `T+N con membresía` a medida que las
> vayas verificando en la web de cada una. Deja en blanco (o `?`) lo que no sepas
> todavía — en la web NO se mostrará aviso para las que estén sin dato (mejor no
> mostrar nada que mostrar algo incorrecto).
>
> **Notación:**
> - `T+N` = cuántos días hacia adelante puedes ver/reservar desde hoy.
>   Ej: T+6 = hoy es miércoles → puedes reservar hasta el martes siguiente.
> - Si abre a una hora específica el día de release, anótalo en "Notas"
>   (ej: Better abre T+7 a las 22:00).
> - Si no distingue membresía, pon el mismo valor en ambas columnas.

## Cómo lo confirmaste (tip)
Abre la web de booking de la cancha y mira hasta qué fecha te deja avanzar en el
calendario sin estar logueado (= sin membresía). Luego, si tienes cuenta/membresía,
mira hasta dónde llega logueado (= con membresía).

---

## Better (requiere cuenta; membresía Better = "Concessionary"/abono)

| Cancha | Postcode | T+N sin membresía | T+N con membresía | Notas |
|--------|----------|-------------------|-------------------|-------|
| Highbury Fields | N5 1AR | T+6 | T+7 | release ~22:00 (membership abre esa noche) |
| Islington Tennis Centre (Outdoor) | N7 9LN | T+6 | T+7 | release ~22:00 |
| Islington Tennis Centre (Indoor) | N7 9LN | T+6 | T+7 | release ~22:00 |
| Tufnell Park | N7 0PG | T+6 | T+7 | release ~22:00 |
| Rosemary Gardens | N1 2DT | T+6 | T+7 | release ~22:00 |
| Hackney Parks (Outdoor) | E9 5SF | T+6 | T+7 | Better (confirmado) |
| Gunnersbury Park | W3 8LQ | T+6 | T+7 | Better (confirmado) |

Links base de booking (Better):
- Highbury Fields: https://bookings.better.org.uk/location/islington-tennis-centre/highbury-tennis
- Islington Outdoor: https://bookings.better.org.uk/location/islington-tennis-centre/tennis-court-outdoor
- Islington Indoor: https://bookings.better.org.uk/location/islington-tennis-centre/tennis-court-indoor
- Tufnell Park: https://bookings.better.org.uk/location/islington-tennis-centre/tufnell-park-tennis
- Rosemary Gardens: https://bookings.better.org.uk/location/islington-tennis-centre/rosemary-gardens-tennis
- Hackney Parks (Outdoor): https://bookings.better.org.uk/location/hackney-parks/tennis-court-outdoor
- Gunnersbury Park: https://bookings.better.org.uk/location/gunnersbury-park-sports-hub/tennis-court-outdoor

---

## ClubSpark (LTA)

| Cancha | Postcode | T+N sin membresía | T+N con membresía | Notas |
|--------|----------|-------------------|-------------------|-------|
| Kennington Park | SE11 4BE | T+6 | T+6 | sin membresía; abre de noche |
| Archbishops Park | SE1 7LE | T+6 | T+6 | sin membresía |
| Burgess Park | SE5 0RJ | T+6 | T+6 | sin membresía; slots de 30 min |
| Vauxhall Park | SW8 1LA | T+6 | T+6 | sin membresía |
| Larkhall Park | SW8 1QQ | T+6 | T+6 | sin membresía |
| Battersea Park | SW11 4NJ | T+1 | T+6 | confirmado por Javier |
| Clapham Common | SW4 9DE | T+6 | T+6 | sin membresía |
| Myatts Field Park | SE5 9RA | T+7 | T+7 | |
| Parliament Hill | NW5 1QR | T+2 | T+4 | |
| Finsbury Park | N4 2NQ | T+7 | T+7 | |
| Queens Park | NW6 6SG | T+2 | T+7 | |
| Clissold Park | N16 9HJ | T+6 | T+6 | sin membresía |
| Hackney Downs | E5 8ND | T+6 | T+6 | sin membresía |
| Millfields Park | E5 0AR | T+6 | T+6 | sin membresía |
| London Fields | E8 3EU | T+6 | T+6 | sin membresía |
| Spring Hill | E5 9BE | T+6 | T+6 | sin membresía |
| Abbotts Park | E17 5PJ | T+5 | T+7 | Waltham Forest |
| Lloyd & Aveling Park | E17 4PP | T+5 | T+7 | Waltham Forest |
| Avondale Park | W11 4EY | T+6 | T+6 | sin membresía |
| Kensington Memorial Park | W11 4QP | T+6 | T+6 | sin membresía |
| Chelmsford Square | NW10 3AR | T+7 | T+7 | |
| Ravenscourt Park | W6 0UL | T+7 | T+7 | |
| Acton Park | W3 7JB | T+6 | T+6 | sin membresía |

Links base de booking (ClubSpark): `https://clubspark.lta.org.uk/<slug>/Booking/BookByDate`
(Abbotts y Lloyd usan dominio propio: `https://abbotts.playtenniswalthamforest.com/Booking/BookByDate` y `https://lloyd.playtenniswalthamforest.com/Booking/BookByDate`)

---

## Camden Active

| Cancha | Postcode | T+N sin membresía | T+N con membresía | Notas |
|--------|----------|-------------------|-------------------|-------|
| Kilburn Grange | NW6 2JH | T+35 | T+35 | 5 semanas de anticipación; server a veces da timeout |
| Waterlow Park | N6 5HG | T+35 | T+35 | 5 semanas de anticipación |

Link base: https://camdenactive.camden.gov.uk/courses/27/tennis/

---

## Parks / Flow (Royal Parks)

| Cancha | Postcode | T+N sin membresía | T+N con membresía | Notas |
|--------|----------|-------------------|-------------------|-------|
| Hyde Park | W2 2UH | T+7 | T+7 | |
| Regent's Park | NW1 4NR | T+7 | T+7 | |

Links base:
- Hyde Park: https://sportsandleisureroyalparks.bookings.flow.onl/location/hyde-park-courts/tennis
- Regent's Park: https://sportsandleisureroyalparks.bookings.flow.onl/location/the-regents-park-courts/tennis

---

## Courtside (solo-enlace, sin scraping)

| Cancha | Postcode | T+N | Notas |
|--------|----------|-----|-------|
| Victoria Park (Tower Hamlets) | E9 7DE | T+7 (según Javier: hoy..T+7) | web no permite ver horarios; pin solo-enlace |

Link: https://tennistowerhamlets.com/book/courts/victoria-park

---

## Pendiente de implementar (cuando esté la mayoría de los datos)

1. Agregar campo `bookingWindow` (sin/ con membresía) a cada venue en `ALL_VENUES_STATIC` (CourtFinder.tsx).
2. Mostrar aviso en el **popup del pin** y en el **panel expandido**:
   - Texto calculado con la fecha límite real (ej: "Sin membresía: hasta jue 9 oct").
3. Agregar **ícono/botón "Ir a la web de reservas"** que abra el link BASE de la cancha
   (sin fecha/cancha específica), separado del botón "Reservar" que lleva al slot.
