export type PaymentStatus = 'pendiente' | 'pagado_sin_validar' | 'pagado';
export type PaymentStatusMap = Map<string, PaymentStatus>;
export interface PagosWebRow {
  profile_id: string;
  nombre: string;
  division: string;
  torneo: string;
  estado: PaymentStatus;
  fecha_autoreporte: string | null;
  fecha_validacion: string | null;
}
