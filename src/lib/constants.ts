import type { BookingVenueKey } from '../types';

// Profile ID autorizado para ver "Buscar clases"
export const BUSCAR_CLASES_ALLOWED_ID = "fb045715-86c6-48fc-88dc-c784fa5ed2bc";

// 🔹 CARRUSEL DE FOTOS ANTERIORES (home)
export const PHOTOS_BASE_PATH = '/fotos-anteriores';

export const highlightPhotos = [
  // PPC 2 – Foto 1 a 3
  {
    src: `${PHOTOS_BASE_PATH}/PPC2-Foto1.jpeg`,
    alt: 'Final PPC versión 2',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC2-Foto2.jpeg`,
    alt: 'Final PPC versión 2',
    caption: '',
  },

  // PPC 3 – Foto 1 a 3
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto1.jpeg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto2.jpeg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto3.jpg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto4.jpeg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },

  // PPC 4 – Foto 1 a 3
  {
    src: `${PHOTOS_BASE_PATH}/PPC4-Foto1.jpeg`,
    alt: 'Final PPC versión 4',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC4-Foto2.jpeg`,
    alt: 'Final PPC versión 4',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC4-Foto3.jpeg`,
    alt: 'Final PPC versión 4',
    caption: '',
  },
];

export const BOOKING_VENUES = {
  highbury: {
    key: 'highbury' as BookingVenueKey,
    venue_slug: 'islington-tennis-centre',
    activity_slug: 'highbury-tennis',
    venue_label: 'Highbury Fields (Islington Tennis Centre)',
    activity_label: 'Highbury Tennis',
    courtOptions: Array.from({ length: 11 }, (_, i) => ({
      short: `Court ${i + 1}`,
      full: `Highbury Fields Tennis Court ${i + 1}`,
    })),
    defaultPreferences: ['Court 11', 'Court 10', 'Court 9'],
  },
  rosemary: {
    key: 'rosemary' as BookingVenueKey,
    venue_slug: 'islington-tennis-centre',
    activity_slug: 'rosemary-gardens-tennis',
    venue_label: 'Rosemary Gardens (Islington Tennis Centre)',
    activity_label: 'Rosemary Gardens Tennis',
    courtOptions: [
      { short: 'Court 1', full: 'Rosemary Gardens Tennis Court 1' },
      { short: 'Court 2', full: 'Rosemary Gardens Tennis Court 2' },
    ],
    defaultPreferences: ['Court 1', 'Court 2', ''],
  },
} as const;
