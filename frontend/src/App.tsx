import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchBanks, fetchPeriods } from "./api/client";
import type { Period } from "./api/client";
import { BankList } from "./components/BankList";
import { TrendChart } from "./components/TrendChart";
import { RankingChart } from "./components/RankingChart";
import { PeriodFilter } from "./components/PeriodFilter";
import { ValuationTab } from "./components/ValuationTab";
import { ScreeningTab } from "./components/ScreeningTab";
import { LangSwitcher } from "./components/LangSwitcher";

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"ranking" | "valuation" | "screening">("ranking");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);

  useEffect(() => {
    const periodsPromise = fetchPeriods().then((res: any) => res.data as Period[] ?? []);
    const banksPromise = fetchBanks().then((res: any) => res.meta?.period as Period | null ?? null);

    Promise.all([periodsPromise, banksPromise]).then(([fetchedPeriods, metaPeriod]) => {
      setPeriods(fetchedPeriods);
      const defaultPeriod = metaPeriod ?? fetchedPeriods[0] ?? null;
      setSelectedPeriod(defaultPeriod);
    });
  }, []);

  return (
    <main style={{ minWidth: "1280px", padding: "1.5rem" }}>
      {/* Header + Tab navigator */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          marginBottom: "1.5rem",
          background: "linear-gradient(135deg, #0f1b35 0%, #1a2f5e 60%, #0f2447 100%)",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(15,27,53,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Logo / Branding */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0.9rem 1.75rem",
            borderRight: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span style={{ fontSize: "0.62rem", color: "rgba(200,215,255,0.4)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "3px" }}>
            {t("brand_subtitle")}
          </span>
          <h1>{t("brand_title")}</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 0.5rem" }}>
          {(["ranking", "valuation", "screening"] as const).map((tab) => {
            const label = tab === "ranking" ? `📊  ${t("tab_ranking")}` : tab === "valuation" ? `💎  ${t("tab_valuation")}` : `🎯  ${t("tab_screening")}`;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "1.1rem 1.75rem",
                  border: "none",
                  borderBottom: isActive ? "3px solid #f5c842" : "3px solid transparent",
                  background: "none",
                  cursor: "pointer",
                  color: isActive ? "#f5c842" : "rgba(200,215,255,0.65)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "1rem",
                  letterSpacing: "0.04em",
                  transition: "color 0.2s, border-color 0.2s",
                  textShadow: isActive ? "0 0 12px rgba(245,200,66,0.5)" : "none",
                  borderRadius: 0,
                  opacity: 1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <LangSwitcher />
      </div>

      {activeTab === "ranking" && (
        <>
          <section className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "14px" }}>
              <h2 style={{ margin: 0 }}>{t("section_bank_list")}</h2>
              <PeriodFilter periods={periods} selected={selectedPeriod} onChange={setSelectedPeriod} />
            </div>
            <BankList
              onSelectBank={setSelectedBank}
              selectedBank={selectedBank}
              selectedPeriod={selectedPeriod}
            />
          </section>

          <section className="card" style={{ marginTop: "1rem" }}>
            <h2>{t("section_trend")}</h2>
            <TrendChart selectedBank={selectedBank} selectedPeriod={selectedPeriod} />
          </section>

          <section className="card" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "14px" }}>
              <h2 style={{ margin: 0 }}>{t("section_ranking")}</h2>
              <PeriodFilter periods={periods} selected={selectedPeriod} onChange={setSelectedPeriod} />
            </div>
            <RankingChart selectedPeriod={selectedPeriod} />
          </section>
        </>
      )}

      {activeTab === "valuation" && (
        <div className="card">
          <h2 style={{ marginBottom: "16px" }}>{t("section_valuation")}</h2>
          <ValuationTab />
        </div>
      )}

      {activeTab === "screening" && (
        <div className="card">
          <ScreeningTab />
        </div>
      )}
    </main>
  );
}
