import { ImageResponse } from "next/og";

export const alt = "CIMDATA Studienplaner: Weiterbildungen nach Starttermin planen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "CIMDATA Studienplaner";
const EYEBROW = "WEITERBILDUNG PLANEN";
const BODY_TEXT = [
  EYEBROW,
  "Kurse nach Starttermin finden, einen eigenen Lernpfad planen und als Link teilen.",
  "Unabhängiges Projekt · Daten von cimdata.de"
].join("");

/**
 * Lädt eine Google-Schrift als TrueType, beschränkt auf die benötigten Zeichen
 * (Muster aus der Vercel-Dokumentation). Ohne Netz fällt das Bild auf die
 * eingebaute Schrift zurück.
 */
async function loadGoogleFont(family: string, weight: number, text: string) {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const fontUrl = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!fontUrl) return null;
    const response = await fetch(fontUrl);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

// Vorschaubild für geteilte Links (E-Mail, LinkedIn, Messenger), im Stil des Seitenkopfs.
export default async function OpengraphImage() {
  const [titleFont, bodyFont] = await Promise.all([
    loadGoogleFont("Fraunces", 700, TITLE),
    loadGoogleFont("DM+Sans", 400, BODY_TEXT)
  ]);
  const fonts = [
    ...(titleFont ? [{ name: "Fraunces", data: titleFont, weight: 700 as const }] : []),
    ...(bodyFont ? [{ name: "DM Sans", data: bodyFont, weight: 400 as const }] : [])
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #6366f1 100%)",
          color: "#ffffff",
          fontFamily: bodyFont ? "DM Sans" : "sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            color: "rgba(255, 255, 255, 0.6)"
          }}
        >
          {EYEBROW}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              fontWeight: 700,
              lineHeight: 1.05,
              fontFamily: titleFont ? "Fraunces" : "sans-serif"
            }}
          >
            {TITLE}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 36,
              lineHeight: 1.35,
              maxWidth: 900,
              color: "rgba(255, 255, 255, 0.82)"
            }}
          >
            Kurse nach Starttermin finden, einen eigenen Lernpfad planen und als Link teilen.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "rgba(255, 255, 255, 0.55)" }}>
          Unabhängiges Projekt · Daten von cimdata.de
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
