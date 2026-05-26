import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DecisionTimeline } from "./DecisionTimeline";
import { DecisionForm } from "./DecisionForm";
import { DecisionDetail } from "./DecisionDetail";
import type { DecisionEntry } from "../../api/client";

type View = "timeline" | "form" | "detail";

export function DecisionsTab() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("timeline");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<DecisionEntry | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  function goToTimeline() { setView("timeline"); setSelectedId(null); setEditEntry(undefined); setRefreshKey((k) => k + 1); }
  function goToAdd() { setEditEntry(undefined); setView("form"); }
  function goToDetail(id: number) { setSelectedId(id); setView("detail"); }
  function goToEdit(entry: DecisionEntry) {
    setEditEntry(entry);
    setView("form");
  }

  return (
    <div>
      {view === "timeline" && (
        <DecisionTimeline key={refreshKey} onAdd={goToAdd} onSelect={goToDetail} />
      )}

      {view === "form" && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <button onClick={goToTimeline} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", padding: "0.35rem 0.8rem", cursor: "pointer", color: "inherit" }}>
              ← {t("decisions.btn_cancel")}
            </button>
          </div>
          <DecisionForm
            entry={editEntry}
            onSave={goToTimeline}
            onCancel={goToTimeline}
          />
        </div>
      )}

      {view === "detail" && selectedId !== null && (
        <DecisionDetail
          id={selectedId}
          onEdit={goToEdit}
          onBack={goToTimeline}
          onDeleted={goToTimeline}
        />
      )}
    </div>
  );
}
