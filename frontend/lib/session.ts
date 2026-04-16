const SESSION_KEY = "sochmate_session";

function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(SESSION_KEY);
  if (!token) {
    token = generateToken();
    localStorage.setItem(SESSION_KEY, token);
  }
  return token;
}
