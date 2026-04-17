import type {
  GameData,
  GameListItem,
  GameStatusData,
  SubmitResponse,
} from "@/types/analysis";
import { getToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function submitGame(
  input: string,
  userColor: "white" | "black" | null
): Promise<SubmitResponse> {
  return request<SubmitResponse>("/api/games", {
    method: "POST",
    body: JSON.stringify({ input, user_color: userColor }),
  });
}

export async function getGameStatus(gameId: string): Promise<GameStatusData> {
  return request<GameStatusData>(`/api/games/${gameId}/status`);
}

export async function getGame(gameId: string): Promise<GameData> {
  return request<GameData>(`/api/games/${gameId}`);
}

export async function listMyGames(): Promise<GameListItem[]> {
  return request<GameListItem[]>("/api/users/me/games");
}
