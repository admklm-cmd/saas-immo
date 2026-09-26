import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import { BRAND } from "@/components/brand";

import "./globals.css";

/**
 * Three families, four roles (docs/design-system.md §2.2). `next/font/google`
 * downloads the files at BUILD time and serves them from our own origin: the
 * browser never calls Google. Each family only exposes a CSS variable, read by
 * the `@theme` tokens of app/globals.css (--font-sans, --font-display,
 * --font-mono). `display: swap` keeps text readable while a file loads, and
 * next/font's metric-adjusted fallback limits the layout shift.
 */
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });

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
    <html
      lang="fr"
      className={`${inter.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
