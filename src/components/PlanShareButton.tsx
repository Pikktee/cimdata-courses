"use client";

import { useEffect, useState } from "react";

type Feedback = { id: number; text: string };

export function PlanShareButton() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  useEffect(() => {
    if (!feedback) return;

    setFeedbackVisible(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setFeedbackVisible(true));
    });

    const hideTimer = window.setTimeout(() => setFeedbackVisible(false), 1900);
    const removeTimer = window.setTimeout(() => {
      setFeedback(null);
      setFeedbackVisible(false);
    }, 1900 + 260);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
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
            feedback.text !== "Link kopiert" ? "hero-share-note--wrap" : "",
            feedbackVisible ? "hero-share-note--visible" : ""
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
