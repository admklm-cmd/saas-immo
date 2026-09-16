import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AiaA",
  description: "AiaA — CRM et agents IA pour agences immobilières indépendantes (prototype).",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
