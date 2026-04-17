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
      // We trust the stored token — no round-trip to /me on load.
      // The token carries the user info we need for display.
      try {
        const payload = _decodeJwtPayload(stored);
        if (payload && payload.exp * 1000 > Date.now()) {
          // Token is not expired; we'll re-fetch user profile from /api/auth/me
          // to get email/username. For now store the token and fetch profile.
          setTokenState(stored);
          _fetchMe(stored).then(setUser).catch(() => {
            clearToken();
            setTokenState(null);
          });
        } else {
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
    setToken(res.access_token);
    setTokenState(res.access_token);
    setUser({ user_id: res.user_id, email: res.email, username: res.username });
    return res.access_token;
  }, []);

  const register = useCallback(
    async (email: string, password: string, username?: string) => {
      const res = await apiRegister(email, password, username);
      setToken(res.access_token);
      setTokenState(res.access_token);
      setUser({ user_id: res.user_id, email: res.email, username: res.username });
      return res.access_token;
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
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
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}
