// Local-only auth bypass for development and demos. Lets you exercise the full
// UI/API without a GitHub OAuth round-trip. INERT in production: it requires
// NODE_ENV !== "production" AND an explicit LABNOTES_DEV_LOGIN env var.
export const DEV_LOGIN = process.env.LABNOTES_DEV_LOGIN;
export const DEV_TOKEN = "dev-token";
export const devMode = process.env.NODE_ENV !== "production" && Boolean(DEV_LOGIN);
