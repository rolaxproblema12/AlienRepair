// Helper centralizado para extraer mensajes de error legibles.
// Maneja Error, PostgrestError de Supabase, y unknown.

interface SupabaseLikeError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

export function getErrorMessage(err: unknown): string {
  if (err == null) return 'Error desconocido';
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as SupabaseLikeError;
    if (typeof e.message === 'string' && e.message.length > 0) {
      // Postgres FK / unique violations son crípticos por defecto;
      // mejoramos los más comunes.
      if (e.code === '23505') return 'Ya existe un registro con esos datos.';
      if (e.code === '23503') return 'No se puede completar: hay registros relacionados.';
      if (e.code === '23514') return e.message; // check constraint, mensaje suele ser claro
      if (e.code === 'PGRST301') return 'Sin permiso para esta operación.';
      return e.message;
    }
    if (typeof e.details === 'string') return e.details;
    if (typeof e.hint === 'string') return e.hint;
  }
  return 'Error inesperado';
}
