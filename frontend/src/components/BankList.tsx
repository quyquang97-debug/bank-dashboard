import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchBanks } from "../api/client";
import type { Period } from "../api/client";

interface BankRow {
  stockCode: string;
  npl: number | null;
  llr: number | null;
  ldr: number | null;
  tangTruongDoanhThu: number | null;
  totalDiem: number | null;
}

interface Props {
  onSelectBank: (code: string) => void;
  selectedBank: string | null;
  selectedPeriod: Period | null;
}

function fmt(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2) + "%";
}

function fmtDiem(value: number | null): string {
  if (value === null) return "—";
  return String(value);
}

export function BankList({ onSelectBank, selectedBank, selectedPeriod }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const prevPeriodRef = useRef<Period | null | undefined>(undefined);

  useEffect(() => {
    const prev = prevPeriodRef.current;
    prevPeriodRef.current = selectedPeriod;

    // Skip re-fetch when App initializes selectedPeriod from meta.period for the first time.
    // BankList already fetched with no-params (server-detected period) on mount.
    if (prev === null && selectedPeriod !== null) return;

    const controller = new AbortController();
    setData([]);
    setLoading(true);
    setError(false);
    fetchBanks(selectedPeriod ?? undefined, controller.signal)
      .then((res: any) => setData(res.data ?? []))
      .catch((err: any) => {
        if (err.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [selectedPeriod]);

  if (loading) return <p>{t("loading")}</p>;
  if (error) return <p>{t("error_load")}</p>;
  if (data.length === 0) return <p>{t("no_data_period")}</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{t("col_bank")}</th>
          <th>{t("col_npl")}</th>
          <th>{t("col_llr")}</th>
          <th>{t("col_ldr")}</th>
          <th>{t("col_growth")}</th>
          <th>{t("col_total_score")}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr
            key={row.stockCode}
            onClick={() => onSelectBank(row.stockCode)}
            className={selectedBank === row.stockCode ? "selected" : ""}
            style={{ cursor: "pointer" }}
          >
            <td>{row.stockCode}</td>
            <td>{fmt(row.npl)}</td>
            <td>{fmt(row.llr)}</td>
            <td>{fmt(row.ldr)}</td>
            <td>{fmt(row.tangTruongDoanhThu)}</td>
            <td>{fmtDiem(row.totalDiem)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
