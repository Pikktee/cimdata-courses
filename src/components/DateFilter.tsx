type DateFilterOption = {
  value: string;
  label: string;
};

type DateFilterProps = {
  options: DateFilterOption[];
  /** Beschriftung der Option „alle Termine“, z. B. mit Kursanzahl. */
  allLabel: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Zusätzliche Klassen für die umschließende Control-Card (z. B. Hervorhebung). */
  className?: string;
};

export function DateFilter({
  options,
  allLabel,
  value,
  onChange,
  disabled = false,
  className
}: DateFilterProps) {
  return (
    <div className={className ? `control-card ${className}` : "control-card"}>
      <div className="control-head">
        <label htmlFor="startdate" className="control-label">
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
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Startdatum
        </label>
      </div>

      <select
        id="startdate"
        className="select-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
