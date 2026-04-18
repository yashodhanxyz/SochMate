"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LogoMark from "@/components/LogoMark";

export default function NavBar() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          <LogoMark size={20} color="white" />
          SochMate
        </Link>

        <div className="flex items-center gap-4">
          {!loading && (
            <>
              {user ? (
                <>
                  <Link
                    href="/games"
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    My Games
                  </Link>
                  <Link
                    href="/openings"
                    className="text-sm hidden sm:block"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Openings
                  </Link>
                  <Link
                    href="/gambits"
                    className="text-sm hidden sm:block"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Gambits
                  </Link>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm hidden sm:block"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {user.username ?? user.email}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/login"
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm px-3 py-1.5 rounded-lg font-medium"
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                    }}
                  >
                    Get started
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
