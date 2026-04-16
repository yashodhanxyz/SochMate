import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SochMate — Chess Analysis",
  description: "Analyze your chess games move by move and improve over time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              ♟ SochMate
            </Link>
            <Link
              href="/games"
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              My Games
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
