import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PreferencesProvider } from "@/components/preferences-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "NUB System",
  description: "Sistema profesional de gestion para barberias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <PreferencesProvider>
          <AuthProvider>{children}</AuthProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
