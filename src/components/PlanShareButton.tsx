"use client";

import { useEffect, useState } from "react";

type Feedback = { id: number; text: string };

// Gesamtdauer der CSS-Animation `hero-share-note-flash` (Fade-In + Standzeit
// + Fade-Out) aus globals.css. Danach wird der Hinweis aus dem DOM entfernt.
const FEEDBACK_DURATION_MS = 2160;

export function PlanShareButton() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!feedback) return;

    const removeTimer = window.setTimeout(
      () => setFeedback(null),
      FEEDBACK_DURATION_MS
    );

    return () => window.clearTimeout(removeTimer);
  }, [feedback]);

  const handleShare = async () => {
    let text: string;
    try {
      await navigator.clipboard.writeText(window.location.href);
      text = "Link kopiert";
    } catch {
      text = "Link bereit (URL kopieren)";
    }
    setFeedback((prev) => ({
      id: (prev?.id ?? 0) + 1,
      text
    }));
  };

  return (
    <div
      className="hero-share-wrap has-tooltip"
      data-tooltip="Erstellt einen teilbaren Link mit deinen aktuellen Einstellungen: Startdatum, Studienplan und ausgeblendete Kurse."
      aria-live="polite"
    >
      {feedback && (
        <span
          key={feedback.id}
          role="status"
          className={[
            "hero-share-note",
            "hero-share-note--flash",
            feedback.text !== "Link kopiert" ? "hero-share-note--wrap" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {feedback.text}
        </span>
      )}
      <button
        type="button"
        className="hero-share-btn"
        onClick={handleShare}
        aria-label="Plan teilen: aktuellen Link in die Zwischenablage kopieren. Umfasst Startdatum, Studienplan und ausgeblendete Kurse."
      >
        Plan teilen
      </button>
    </div>
  );
}
