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

const description =
  "CIMDATA-Weiterbildungen nach Starttermin durchsuchen, einen eigenen Studienplan zusammenstellen und als Link teilen.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cimdata-kurse.henrikheil.net"),
  title: "CIMDATA Studienplaner",
  description,
  openGraph: {
    title: "CIMDATA Studienplaner",
    description,
    type: "website",
    locale: "de_DE",
    siteName: "CIMDATA Studienplaner"
  }
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
