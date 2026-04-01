"use client";

import { useEffect, useState } from "react";

export function PlanShareButton() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Link kopiert");
    } catch {
      setNotice("Link bereit (URL kopieren)");
    }
  };

  return (
    <div className="hero-share-wrap" aria-live="polite">
      <button
        type="button"
        className="hero-share-btn"
        onClick={handleShare}
        title="Aktuellen Plan teilen"
      >
        Plan teilen
      </button>
      {notice && <span className="hero-share-note">{notice}</span>}
    </div>
  );
}
