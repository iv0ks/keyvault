// Runtime configuration, read once from the environment.
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL', 'postgres://keyvault:keyvault@localhost:5432/keyvault'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-insecure-secret-change-me'),
  // The challenge flag, baked into the image at build time and seeded into the
  // victim's secret. Never committed.
  flag: required('FLAG', 'FLAG{KEYVAULT_GUESSING_NOT_REQUIRED}'),
};
