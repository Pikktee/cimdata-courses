import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "CIMDATA Studienplaner",
  description:
    "CIMDATA-Weiterbildungen nach Starttermin durchsuchen, einen persönlichen Studienplan zusammenstellen und per Link teilen — inklusive ausgeblendeter Kurse und aktueller Filter in der URL."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
