// Google login is built but hidden in the public beta: nothing about it renders
// (and Google's script never loads) unless NEXT_PUBLIC_AUTH_ENABLED=true.
// The server must have AUTH_ENABLED=true with the same client id.

export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
