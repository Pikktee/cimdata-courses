type DateFilterProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  courseCount: number;
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
  courseCount,
  disabled = false
}: DateFilterProps) {
  const countLabel = courseCount === 1 ? "Kurs" : "Kurse";

  return (
    <div className="control-card">
      <div className="control-head">
        <span className="control-label">Startdatum</span>
        <span className="control-count" aria-live="polite">
          {courseCount} {countLabel}
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
        <option value="all">Alle Termine</option>
        {options.map((date) => (
          <option key={date} value={date}>
            {formatDate(date)}
          </option>
        ))}
      </select>
    </div>
  );
}
