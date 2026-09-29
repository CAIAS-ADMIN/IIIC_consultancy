function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  RUSTFS_ENDPOINT: process.env.RUSTFS_ENDPOINT ?? "",
  RUSTFS_ACCESS_KEY: process.env.RUSTFS_ACCESS_KEY ?? "",
  RUSTFS_SECRET_KEY: process.env.RUSTFS_SECRET_KEY ?? "",
  RUSTFS_BUCKET: process.env.RUSTFS_BUCKET ?? "",
  RUSTFS_REGION: process.env.RUSTFS_REGION ?? "us-east-1",
  KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER ?? "",
  KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID ?? "",
  KEYCLOAK_CLIENT_SECRET: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
  // Keycloak identity-provider alias to jump straight to (skips the Keycloak
  // login page). Set to an empty string to show the Keycloak page again.
  KEYCLOAK_IDP_HINT: process.env.KEYCLOAK_IDP_HINT ?? "google",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
  JOBS_SHARED_SECRET: process.env.JOBS_SHARED_SECRET ?? "",
};
