"use client";

import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface Props {
  onError?: (msg: string) => void;
}

export default function GoogleSignInButton({ onError }: Props) {
  const { loginWithToken } = useAuth();
  const router = useRouter();

  if (!CLIENT_ID) return null;

  async function handleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      onError?.("Google sign-in did not return a token.");
      return;
    }
    try {
      const res = await fetch(`${BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError?.(data?.detail ?? "Google sign-in failed.");
        return;
      }
      // Update AuthContext state + localStorage in one call — this is what
      // makes the rest of the UI (GameInput, NavBar) react immediately.
      loginWithToken(data.access_token, {
        user_id: data.user_id,
        email: data.email,
        username: data.username,
      });
      router.push("/");
    } catch {
      onError?.("Google sign-in failed. Please try again.");
    }
  }

  return (
    <div className="w-full flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError?.("Google sign-in failed. Please try again.")}
        theme="filled_black"
        shape="rectangular"
        width="100%"
        text="continue_with"
      />
    </div>
  );
}
