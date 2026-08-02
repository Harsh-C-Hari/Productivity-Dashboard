// Auth token storage + cross-module event bus.
//
// Split out from lib/api.ts (which owns the actual HTTP calls) so the
// "where do tokens live and who gets told when they change" concerns
// have exactly one home -- reused by both lib/api.ts's 401 interceptor
// and context/AuthContext.tsx's React-facing state. Mirrors the
// project's existing "one file, one responsibility" pattern (see e.g.
// how routers/auth.py and routers/sessions.py are split on the backend).
//
// Storage choice: the *refresh* token is the only thing persisted --
// it's long-lived (30 days) and is what "staying signed in" means. The
// *access* token is short-lived (30 min) and deliberately kept in
// memory only (module-level variable below), never written to
// localStorage/sessionStorage, so it can't be read by a second script
// via storage inspection; it's simply re-derived from the refresh
// token on page load.
//
// "Remember me" controls *which* Storage the refresh token goes in:
// localStorage (survives closing the browser) vs sessionStorage
// (cleared when the tab/window closes). The REMEMBER_KEY flag always
// lives in localStorage (it's not sensitive) so a refresh can find the
// right storage again without the caller having to pass `remember`
// through every call site.
import type { User } from "@/types/auth";

const REFRESH_TOKEN_KEY = "auth:refreshToken";
const REMEMBER_KEY = "auth:remember";

function storageFor(remember: boolean): Storage {
  return remember ? window.localStorage : window.sessionStorage;
}

export function isRemembered(): boolean {
  return window.localStorage.getItem(REMEMBER_KEY) === "1";
}

/** Called once, right after login/register, with the caller's "Remember me" choice. */
export function persistRefreshToken(token: string, remember: boolean): void {
  clearPersistedSession();
  storageFor(remember).setItem(REFRESH_TOKEN_KEY, token);
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

/** Called after a token rotation (refresh/register/login all rotate the
 * refresh token) to swap the stored value without touching the
 * remember-me choice already on record. */
export function updateStoredRefreshToken(token: string): void {
  storageFor(isRemembered()).setItem(REFRESH_TOKEN_KEY, token);
}

export function loadPersistedRefreshToken(): string | null {
  return (
    window.localStorage.getItem(REFRESH_TOKEN_KEY) ??
    window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  );
}

export function clearPersistedSession(): void {
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(REMEMBER_KEY);
}

// ----------------------------------------------------------------------
// In-memory access token
// ----------------------------------------------------------------------

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// ----------------------------------------------------------------------
// Cross-module events
//
// lib/api.ts's request() interceptor runs outside React and can't call
// hooks, so it broadcasts here instead of importing AuthContext
// directly (which would create a circular import: api.ts <-> AuthContext).
// ----------------------------------------------------------------------

type VoidListener = () => void;
type UserListener = (user: User) => void;

const authExpiredListeners = new Set<VoidListener>();
const userRefreshedListeners = new Set<UserListener>();

/** Fired when a 401 couldn't be resolved by a silent refresh (refresh
 * token missing, revoked, or expired) -- the session is over. */
export function onAuthExpired(fn: VoidListener): () => void {
  authExpiredListeners.add(fn);
  return () => authExpiredListeners.delete(fn);
}

export function emitAuthExpired(): void {
  authExpiredListeners.forEach((fn) => fn());
}

/** Fired whenever a background refresh (proactive or 401-triggered)
 * returns a fresh User, so AuthContext's copy of `user` doesn't go
 * stale between explicit profile refetches. */
export function onUserRefreshed(fn: UserListener): () => void {
  userRefreshedListeners.add(fn);
  return () => userRefreshedListeners.delete(fn);
}

export function emitUserRefreshed(user: User): void {
  userRefreshedListeners.forEach((fn) => fn(user));
}
