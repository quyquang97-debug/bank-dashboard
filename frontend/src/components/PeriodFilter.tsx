import type { Period } from "../api/client";

interface Props {
  periods: Period[];
  selected: Period | null;
  onChange: (period: Period) => void;
}

function periodLabel(p: Period): string {
  return p.quarter === 0 ? `${p.year} (Năm)` : `Q${p.quarter}/${p.year}`;
}

function periodKey(p: Period): string {
  return `${p.year}-${p.quarter}`;
}

export function PeriodFilter({ periods, selected, onChange }: Props) {
  if (periods.length === 0) {
    return (
      <select disabled>
        <option>Không có dữ liệu</option>
      </select>
    );
  }

  const selectedKey = selected ? periodKey(selected) : "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = periods.find((x) => periodKey(x) === e.target.value);
    if (p) onChange(p);
  }

  return (
    <select value={selectedKey} onChange={handleChange}>
      {periods.map((p) => (
        <option key={periodKey(p)} value={periodKey(p)}>
          {periodLabel(p)}
        </option>
      ))}
    </select>
  );
}
