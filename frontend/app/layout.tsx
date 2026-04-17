import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import GoogleProvider from "@/components/GoogleProvider";
import NavBar from "@/components/NavBar";
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
        <GoogleProvider>
          <AuthProvider>
            <NavBar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
          </AuthProvider>
        </GoogleProvider>
      </body>
    </html>
  );
}
