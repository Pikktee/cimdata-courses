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

export function DateFilter({ options, value, onChange, disabled = false }: DateFilterProps) {
  return (
    <label className="control-card" htmlFor="startdate">
      <span className="control-label">Startdatum filtern</span>
      <select
        id="startdate"
        className="select-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Bitte Startdatum wählen</option>
        {options.map((date) => (
          <option key={date} value={date}>
            {formatDate(date)}
          </option>
        ))}
      </select>
    </label>
  );
}
