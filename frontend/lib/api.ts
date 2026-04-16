import type {
  GameData,
  GameStatusData,
  SubmitResponse,
} from "@/types/analysis";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
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
  userColor: "white" | "black" | null,
  sessionToken: string
): Promise<SubmitResponse> {
  return request<SubmitResponse>("/api/games", {
    method: "POST",
    body: JSON.stringify({ input, user_color: userColor, session_token: sessionToken }),
  });
}

export async function getGameStatus(gameId: string): Promise<GameStatusData> {
  return request<GameStatusData>(`/api/games/${gameId}/status`);
}

export async function getGame(gameId: string): Promise<GameData> {
  return request<GameData>(`/api/games/${gameId}`);
}

export async function listMyGames(sessionToken: string): Promise<GameStatusData[]> {
  return request<GameStatusData[]>(
    `/api/users/me/games?session_token=${encodeURIComponent(sessionToken)}`
  );
}
