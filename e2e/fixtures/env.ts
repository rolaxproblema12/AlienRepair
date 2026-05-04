/**
 * Lee y valida las variables de entorno requeridas para los e2e.
 * Falla con mensaje claro si falta algo.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Falta variable ${name}. Configurala en .env.local — ver playwright.config.ts.`,
    );
  }
  return v;
}

export const env = {
  supabaseUrl: required('E2E_SUPABASE_URL'),
  supabaseAnonKey: required('E2E_SUPABASE_ANON_KEY'),
  supabaseDbUrl: required('E2E_SUPABASE_DB_URL'),
  userEmail: required('E2E_USER_EMAIL'),
  userPassword: required('E2E_USER_PASSWORD'),
  sucursalId: required('E2E_SUCURSAL_ID'),
};
