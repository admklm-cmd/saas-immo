import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import { BRAND } from "@/components/brand";

import "./globals.css";

/**
 * Four families, five roles (docs/design-system.md §2.2.1). `next/font/google`
 * downloads the files at BUILD time and serves them from our own origin: the
 * browser never calls Google. Each family only exposes a CSS variable, read by
 * the `@theme` tokens of app/globals.css (--font-display, --font-accent,
 * --font-sans, --font-mono). The next/font variable names differ from the
 * token names on purpose: `--font-accent: var(--font-accent)` would be circular.
 * `display: swap` keeps text readable while a file loads, and next/font's
 * metric-adjusted fallback limits the layout shift.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
  variable: "--font-bricolage",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  variable: "--font-instrument-serif",
});
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
      className={`${bricolage.variable} ${instrumentSerif.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
