"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  apiLogin,
  apiRegister,
  clearToken,
  getToken,
  getStoredUser,
  setStoredUser,
  setToken,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  /** Returns the token on success, throws on error. */
  login: (email: string, password: string) => Promise<string>;
  /** Returns the token on success, throws on error. */
  register: (email: string, password: string, username?: string) => Promise<string>;
  /** Set auth state directly from a token response (used by Google OAuth). */
  loginWithToken: (accessToken: string, user: AuthUser) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = getToken();
    if (stored) {
      try {
        const payload = _decodeJwtPayload(stored);
        if (payload && payload.exp * 1000 > Date.now()) {
          // Token not expired — load cached user profile immediately (no server
          // round-trip needed, so the app appears instantly even if offline).
          const cachedUser = getStoredUser();
          if (cachedUser) {
            setTokenState(stored);
            setUser(cachedUser);
          }
          // Refresh profile in the background; only clear session on a real 401.
          _fetchMe(stored)
            .then((freshUser) => {
              setUser(freshUser);
              setStoredUser(freshUser);
              setTokenState(stored);
            })
            .catch((err: unknown) => {
              // Only force logout when the server explicitly rejects the token.
              // Network errors, server restarts, etc. should NOT log the user out.
              if (err instanceof Error && err.message === "401") {
                clearToken();
                setTokenState(null);
                setUser(null);
              }
              // Otherwise keep the cached session alive.
            });
        } else {
          // Token is genuinely expired
          clearToken();
        }
      } catch {
        clearToken();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    const u = { user_id: res.user_id, email: res.email, username: res.username };
    setToken(res.access_token);
    setStoredUser(u);
    setTokenState(res.access_token);
    setUser(u);
    return res.access_token;
  }, []);

  const register = useCallback(
    async (email: string, password: string, username?: string) => {
      const res = await apiRegister(email, password, username);
      const u = { user_id: res.user_id, email: res.email, username: res.username };
      setToken(res.access_token);
      setStoredUser(u);
      setTokenState(res.access_token);
      setUser(u);
      return res.access_token;
    },
    []
  );

  const loginWithToken = useCallback((accessToken: string, authUser: AuthUser) => {
    setToken(accessToken);
    setStoredUser(authUser);
    setTokenState(accessToken);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _decodeJwtPayload(token: string): { exp: number } | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

async function _fetchMe(token: string): Promise<AuthUser> {
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Throw a distinguishable error only for auth rejection — not network errors
  if (res.status === 401) throw new Error("401");
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}
