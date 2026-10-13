type CourseSearchProps = {
  value: string;
  onChange: (value: string) => void;
  /** Zusätzliche Klassen für die umschließende Control-Card. */
  className?: string;
};

export function CourseSearch({ value, onChange, className }: CourseSearchProps) {
  return (
    <div className={className ? `control-card ${className}` : "control-card"} role="search">
      <div className="control-head">
        <label htmlFor="course-search" className="control-label">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ display: "inline", verticalAlign: "-0.12em", marginRight: "0.35rem", opacity: 0.5 }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Kurs suchen
        </label>
      </div>

      <div className="search-field">
        <input
          id="course-search"
          type="search"
          className="search-input"
          placeholder="z. B. Python, UX, Photoshop"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && value) {
              event.preventDefault();
              onChange("");
            }
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {value ? (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onChange("")}
            aria-label="Suche leeren"
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
