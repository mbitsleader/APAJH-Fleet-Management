import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestion de Flotte — APAJH Mayotte",
  description: "Application de gestion du parc automobile pour l'APAJH Mayotte",
};

import { AuthProvider } from "@/context/AuthContext";
import { NetworkStatus } from "@/components/NetworkStatus";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-primary focus:text-white focus:font-bold"
        >
          Passer au contenu principal
        </a>
        <AuthProvider>
          <NetworkStatus />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
