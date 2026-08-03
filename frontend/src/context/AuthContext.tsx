import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { LoginRequest, RegisterRequest, TokenResponse, User } from "@/types/auth";
import {
  clearPersistedSession,
  getAccessToken,
  isRemembered,
  loadPersistedRefreshToken,
  onAuthExpired,
  onUserRefreshed,
  persistRefreshToken,
  setAccessToken,
  updateStoredRefreshToken,
} from "@/lib/authClient";

// How long before the access token's real expiry to proactively rotate
// it, so an in-flight request never races a token that's about to die.
// ACCESS_TOKEN_EXPIRE_MINUTES defaults to 30 on the backend -- refreshing
// 2 minutes early is a large enough safety margin without re-hitting
// /api/auth/refresh too often.
const REFRESH_SKEW_MS = 2 * 60 * 1000;

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (identifier: string, password: string, remember: boolean) => Promise<User>;
  register: (payload: Omit<RegisterRequest, "display_name"> & { display_name?: string }) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function deviceContext(): Pick<LoginRequest, "device" | "platform" | "browser"> {
  if (typeof navigator === "undefined") return {};
  const ua = navigator.userAgent;
  const platform =
    /Win/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Unknown";
  const browser =
    /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown";
  return { device: `${platform} · ${browser}`, platform, browser };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (expiresInSeconds: number) => {
      clearRefreshTimer();
      const delay = Math.max(expiresInSeconds * 1000 - REFRESH_SKEW_MS, 5_000);
      refreshTimer.current = window.setTimeout(() => {
        void refresh();
      }, delay);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [clearRefreshTimer]
  );

  const applyTokens = useCallback(
    (tokens: TokenResponse, remember?: boolean) => {
      setAccessToken(tokens.access_token);
      if (remember === undefined) {
        updateStoredRefreshToken(tokens.refresh_token);
      } else {
        persistRefreshToken(tokens.refresh_token, remember);
      }
      setUser(tokens.user);
      setStatus("authenticated");
      scheduleRefresh(tokens.expires_in);
    },
    [scheduleRefresh]
  );

  const clearSession = useCallback(() => {
    clearRefreshTimer();
    setAccessToken(null);
    clearPersistedSession();
    setUser(null);
    setStatus("unauthenticated");
    // Data-isolation fix: this used to leave every cached query (dashboard
    // widgets, tasks, Study Hub, Project Workspace, AI Workspace,
    // notifications -- everything React Query has ever fetched) sitting in
    // memory. On a shared device, the next person to log in would see
    // stale renders of the previous user's data for a moment (and any
    // component that reads the cache before its own refetch resolves
    // would show it outright). `clearSession` is the single choke point
    // every logout/expiry/failed-refresh path already runs through (see
    // `logout`, `refresh`'s catch branch, and the `onAuthExpired`
    // listener below), so clearing here covers all of them.
    queryClient.clear();
  }, [clearRefreshTimer]);

  const refresh = useCallback(async (): Promise<boolean> => {
    const stored = loadPersistedRefreshToken();
    if (!stored) {
      clearSession();
      return false;
    }
    try {
      // lib/api.ts's request() already knows how to rotate the refresh
      // token on a 401; here we drive the *proactive* rotation the
      // same way login/register do, by hitting /api/auth/refresh
      // directly so we get a full TokenResponse (and thus a fresh
      // `user`) back, not just "some 401 was retried."
      const res = await fetch(
        `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/auth/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: stored }),
        }
      );
      if (!res.ok) throw new Error("refresh failed");
      const tokens = (await res.json()) as TokenResponse;
      applyTokens(tokens);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [applyTokens, clearSession]);

  const login = useCallback(
    async (identifier: string, password: string, remember: boolean) => {
      const tokens = await api.login({
        username_or_email: identifier,
        password,
        ...deviceContext(),
      });
      applyTokens(tokens, remember);
      return tokens.user;
    },
    [applyTokens]
  );

  const register = useCallback(
    async (payload: Omit<RegisterRequest, "display_name"> & { display_name?: string }) => {
      const tokens = await api.register({ display_name: "", ...payload });
      // Registration issues a real session immediately -- default new
      // accounts to "remembered" (most people registering on their own
      // device expect to stay signed in), matching the login page's
      // own default.
      applyTokens(tokens, true);
      return tokens.user;
    },
    [applyTokens]
  );

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) await api.logout();
    } catch {
      // Already unauthenticated/expired -- nothing left to revoke server-side.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Restore session on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadPersistedRefreshToken();
      if (!stored) {
        setStatus("unauthenticated");
        return;
      }
      const ok = await refresh();
      if (cancelled) return;
      if (!ok) setStatus("unauthenticated");
    })();
    return () => {
      cancelled = true;
    };
    // Only ever run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to a 401 that couldn't be silently refreshed (see lib/api.ts),
  // and to background refreshes that bring back a newer `user`.
  useEffect(() => {
    const offExpired = onAuthExpired(() => clearSession());
    const offUser = onUserRefreshed((refreshedUser) => setUser(refreshedUser));
    return () => {
      offExpired();
      offUser();
    };
  }, [clearSession]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout, updateUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { isRemembered };
