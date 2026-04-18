/**
 * Auth token storage and API calls for register/login.
 * JWT stored in localStorage under 'sochmate_token'.
 */

const TOKEN_KEY = "sochmate_token";
const USER_KEY  = "sochmate_user";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AuthUser {
  user_id: string;
  email: string;
  username: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  username: string | null;
}

// ---------------------------------------------------------------------------
// Token storage (localStorage — only usable client-side)
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Cached user profile — avoids a server round-trip on every page load
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ---------------------------------------------------------------------------
// Auth API calls
// ---------------------------------------------------------------------------

async function authRequest<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail ?? `Request failed: ${res.status}`);
  }
  return data as T;
}

export async function apiRegister(
  email: string,
  password: string,
  username?: string
): Promise<TokenResponse> {
  return authRequest<TokenResponse>("/api/auth/register", {
    email,
    password,
    username: username || undefined,
  });
}

export async function apiLogin(
  email: string,
  password: string
): Promise<TokenResponse> {
  return authRequest<TokenResponse>("/api/auth/login", { email, password });
}
