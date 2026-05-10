import { useTranslation } from "react-i18next";
import type { Period } from "../api/client";

interface Props {
  periods: Period[];
  selected: Period | null;
  onChange: (period: Period) => void;
}

function periodKey(p: Period): string {
  return `${p.year}-${p.quarter}`;
}

export function PeriodFilter({ periods, selected, onChange }: Props) {
  const { t } = useTranslation();

  if (periods.length === 0) {
    return (
      <select disabled>
        <option>{t("no_data")}</option>
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
          {p.quarter === 0
            ? t("period_annual", { year: p.year })
            : t("period_quarter", { quarter: p.quarter, year: p.year })}
        </option>
      ))}
    </select>
  );
}
