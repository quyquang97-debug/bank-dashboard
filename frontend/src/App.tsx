import { useEffect, useState } from "react";
import { fetchBanks, fetchPeriods } from "./api/client";
import type { Period } from "./api/client";
import { BankList } from "./components/BankList";
import { TrendChart } from "./components/TrendChart";
import { RankingChart } from "./components/RankingChart";
import { PeriodFilter } from "./components/PeriodFilter";

export default function App() {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);

  useEffect(() => {
    // Fetch periods and banks in parallel (NFR-1)
    const periodsPromise = fetchPeriods().then((res: any) => res.data as Period[] ?? []);
    const banksPromise = fetchBanks().then((res: any) => res.meta?.period as Period | null ?? null);

    Promise.all([periodsPromise, banksPromise]).then(([fetchedPeriods, metaPeriod]) => {
      setPeriods(fetchedPeriods);
      // Set default: meta.period first, fallback to first period from /api/periods
      const defaultPeriod = metaPeriod ?? fetchedPeriods[0] ?? null;
      setSelectedPeriod(defaultPeriod);
    });
  }, []);

  return (
    <main style={{ minWidth: "1280px", padding: "1.5rem" }}>
      <h1>Bank Financial Dashboard</h1>

      <section>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Danh Sách Ngân Hàng</h2>
          <PeriodFilter periods={periods} selected={selectedPeriod} onChange={setSelectedPeriod} />
        </div>
        <BankList
          onSelectBank={setSelectedBank}
          selectedBank={selectedBank}
          selectedPeriod={selectedPeriod}
        />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Xu Hướng</h2>
        <TrendChart selectedBank={selectedBank} selectedPeriod={selectedPeriod} />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Xếp Hạng Ngân Hàng</h2>
        <RankingChart />
      </section>
    </main>
  );
}
