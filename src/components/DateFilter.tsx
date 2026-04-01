type DateFilterProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

export function DateFilter({
  options,
  value,
  onChange,
  disabled = false
}: DateFilterProps) {
  return (
    <div className="control-card">
      <div className="control-head">
        <span className="control-label">
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
        </span>
      </div>

      <label htmlFor="startdate" className="sr-only">
        Startdatum
      </label>
      <select
        id="startdate"
        className="select-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="all">Alle Termine ({options.length})</option>
        {options.map((date) => (
          <option key={date} value={date}>
            {formatDate(date)}
          </option>
        ))}
      </select>
    </div>
  );
}
