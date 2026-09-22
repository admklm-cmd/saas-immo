import type { Metadata } from "next";

import { BRAND } from "@/components/brand";

import "./globals.css";

/**
 * The icons themselves are not declared here: `app/favicon.ico`, `app/icon.png`
 * and `app/apple-icon.png` are picked up by the App Router file convention.
 */
export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.name} — ${BRAND.tagline} (prototype).`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
