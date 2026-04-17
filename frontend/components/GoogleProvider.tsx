"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function GoogleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // If no client ID is configured, render children without the provider.
  // Google button will be hidden on the auth pages in that case.
  if (!CLIENT_ID) return <>{children}</>;
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>{children}</GoogleOAuthProvider>
  );
}
