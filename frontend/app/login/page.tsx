"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already authenticated — bounce to games
  if (!authLoading && user) {
    router.replace("/games");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center" style={{ minHeight: "70vh" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Sign in
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Welcome back to SochMate
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            disabled={loading}
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            disabled={loading}
            autoComplete="current-password"
          />

          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--color-blunder)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all"
            style={{
              background:
                !loading && email && password ? "var(--accent)" : "var(--surface-2)",
              color:
                !loading && email && password ? "#fff" : "var(--text-secondary)",
              cursor: !loading && email && password ? "pointer" : "not-allowed",
              border: "none",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <Divider />

        <GoogleSignInButton onError={setError} />

        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          No account?{" "}
          <Link href="/register" style={{ color: "var(--accent)" }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        or
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  disabled,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />
    </div>
  );
}
