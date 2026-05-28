import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchDecisionSummary, triggerPatternAnalysis, saveManualPattern, updatePattern, deletePattern } from "../../api/client";
import type { DecisionSummaryResponse, PatternResult, PatternCacheEntry } from "../../api/client";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

type PatternItem = { description: string; count: number };

function emptyItem(): PatternItem { return { description: "", count: 1 }; }

export function DecisionSummary() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<DecisionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Manual pattern form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualMistakes, setManualMistakes] = useState<PatternItem[]>([emptyItem()]);
  const [manualSuccesses, setManualSuccesses] = useState<PatternItem[]>([emptyItem()]);
  const [savingManual, setSavingManual] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchDecisionSummary({ from: filterFrom || undefined, to: filterTo || undefined })
      .then((r) => setSummary(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterFrom, filterTo]);

  async function handleComputePatterns() {
    setComputing(true);
    setPatternError(null);
    const lang = i18n.language?.slice(0, 2) ?? "vi";
    try {
      await triggerPatternAnalysis(lang);
      load();
    } catch (err: any) {
      if (err.message === "insufficient_data") setPatternError(t("decisions.insufficient_data"));
      else setPatternError(err.message);
    } finally {
      setComputing(false);
    }
  }

  function openManualForm() {
    setManualMistakes([emptyItem()]);
    setManualSuccesses([emptyItem()]);
    setManualError(null);
    setManualSaved(false);
    setShowManualForm(true);
  }

  async function handleSaveManual() {
    const mistakes = manualMistakes.filter((m) => m.description.trim());
    const successes = manualSuccesses.filter((s) => s.description.trim());
    setSavingManual(true);
    setManualError(null);
    setManualSaved(false);
    try {
      await saveManualPattern({ mistakes, successes });
      setManualSaved(true);
      setShowManualForm(false);
      load();
    } catch (err: any) {
      setManualError(err.message);
    } finally {
      setSavingManual(false);
    }
  }

  const totalPct = summary ? summary.total : 0;

  function pctBar(count: number, color: string, label: string) {
    const pct = totalPct > 0 ? (count / totalPct) * 100 : 0;
    return (
      <div style={{ marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "0.88rem" }}>
          <span>{label}</span>
          <span>{count} ({pct.toFixed(0)}%)</span>
        </div>
        <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 0.4s" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px" }}>
      <h3 style={{ marginBottom: "1rem", opacity: 0.8 }}>{t("decisions.summary.title")}</h3>

      {/* Date filter */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "center" }}>
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" }} />
        <span style={{ opacity: 0.5 }}>→</span>
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          style={{ padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" }} />
      </div>

      {loading && <p style={{ opacity: 0.5 }}>{t("decisions.loading")}</p>}
      {error && <p style={{ color: "#ff6b6b" }}>{t("error_load")}</p>}

      {!loading && summary && (
        <>
          {/* Verdict bars */}
          <div style={{ marginBottom: "1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "1rem" }}>
            <div style={{ marginBottom: "0.75rem", opacity: 0.5, fontSize: "0.82rem" }}>
              {t("decisions.summary.total")}: {summary.total}
            </div>
            {pctBar(summary.correct, "#50dc78", t("decisions.summary.correct"))}
            {pctBar(summary.wrong, "#ff5050", t("decisions.summary.wrong"))}
            {pctBar(summary.unclear, "#f5c842", t("decisions.summary.unclear"))}
          </div>

          {/* Patterns */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600, opacity: 0.8 }}>Patterns</span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={openManualForm}
                  disabled={showManualForm}
                  style={{
                    padding: "0.35rem 0.9rem", background: "rgba(255,255,255,0.08)", color: "inherit",
                    border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", fontWeight: 600,
                    cursor: showManualForm ? "not-allowed" : "pointer",
                    opacity: showManualForm ? 0.5 : 1, fontSize: "0.85rem",
                  }}
                >
                  {t("decisions.btn_add_manual_pattern")}
                </button>
                <button
                  onClick={handleComputePatterns}
                  disabled={computing || summary.total < 5}
                  style={{
                    padding: "0.35rem 0.9rem", background: "#f5c842", color: "#0f1b35",
                    border: "none", borderRadius: "6px", fontWeight: 600, cursor: computing || summary.total < 5 ? "not-allowed" : "pointer",
                    opacity: computing || summary.total < 5 ? 0.5 : 1, fontSize: "0.85rem",
                  }}
                >
                  {computing ? "…" : t("decisions.btn_patterns")}
                </button>
              </div>
            </div>

            {patternError && <p style={{ color: "#ff6b6b", fontSize: "0.85rem" }}>{patternError}</p>}
            {manualSaved && <p style={{ color: "#50dc78", fontSize: "0.85rem" }}>{t("decisions.manual_pattern_saved")}</p>}

            {showManualForm && (
              <ManualPatternForm
                mistakes={manualMistakes}
                successes={manualSuccesses}
                saving={savingManual}
                error={manualError}
                onSetMistakes={setManualMistakes}
                onSetSuccesses={setManualSuccesses}
                onSave={handleSaveManual}
                onCancel={() => setShowManualForm(false)}
              />
            )}

            {summary.patternCaches?.length > 0 ? (
              <PatternCacheList caches={summary.patternCaches} onRefresh={load} />
            ) : (
              <p style={{ opacity: 0.45, fontSize: "0.85rem" }}>
                {summary.total < 5 ? t("decisions.insufficient_data") : t("decisions.no_pattern")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PatternItemList({
  list, setList, color, label,
  onUpdate, onRemove,
}: {
  list: PatternItem[];
  setList: (v: PatternItem[]) => void;
  color: string;
  label: string;
  onUpdate: (index: number, field: keyof PatternItem, value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontWeight: 600, color, marginBottom: "0.4rem", fontSize: "0.88rem" }}>{label}</div>
      {list.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem", alignItems: "center" }}>
          <input
            type="text"
            value={item.description}
            placeholder={t("decisions.manual_pattern_desc_placeholder")}
            onChange={(e) => onUpdate(i, "description", e.target.value)}
            style={{
              flex: 1, padding: "0.35rem 0.6rem", borderRadius: "5px",
              border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", fontSize: "0.85rem",
            }}
          />
          <input
            type="number"
            min={1}
            value={item.count}
            title={t("decisions.manual_pattern_count")}
            onChange={(e) => onUpdate(i, "count", Number(e.target.value) || 1)}
            style={{
              width: "60px", padding: "0.35rem 0.5rem", borderRadius: "5px",
              border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", fontSize: "0.85rem", textAlign: "center",
            }}
          />
          {list.length > 1 && (
            <button
              onClick={() => onRemove(i)}
              style={{ background: "none", border: "none", color: "#ff5050", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem" }}
            >×</button>
          )}
        </div>
      ))}
      <button
        onClick={() => setList([...list, { description: "", count: 1 }])}
        style={{ fontSize: "0.82rem", opacity: 0.6, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
      >
        {t("decisions.manual_pattern_add_item")}
      </button>
    </div>
  );
}

function ManualPatternForm({
  mistakes, successes, saving, error,
  onSetMistakes, onSetSuccesses,
  onSave, onCancel,
}: {
  mistakes: PatternItem[];
  successes: PatternItem[];
  saving: boolean;
  error: string | null;
  onSetMistakes: (v: PatternItem[]) => void;
  onSetSuccesses: (v: PatternItem[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  function updateMistake(index: number, field: keyof PatternItem, value: string | number) {
    onSetMistakes(mistakes.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }
  function removeMistake(index: number) {
    onSetMistakes(mistakes.filter((_, i) => i !== index));
  }
  function updateSuccess(index: number, field: keyof PatternItem, value: string | number) {
    onSetSuccesses(successes.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }
  function removeSuccess(index: number) {
    onSetSuccesses(successes.filter((_, i) => i !== index));
  }

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1rem", marginTop: "0.5rem" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.75rem", opacity: 0.8, fontSize: "0.9rem" }}>
        {t("decisions.manual_pattern_title")}
      </div>

      <PatternItemList
        list={mistakes}
        setList={onSetMistakes}
        color="#ff5050"
        label={t("decisions.manual_pattern_mistakes")}
        onUpdate={updateMistake}
        onRemove={removeMistake}
      />
      <PatternItemList
        list={successes}
        setList={onSetSuccesses}
        color="#50dc78"
        label={t("decisions.manual_pattern_successes")}
        onUpdate={updateSuccess}
        onRemove={removeSuccess}
      />

      {error && <p style={{ color: "#ff6b6b", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "0.4rem 1rem", background: "#50dc78", color: "#0f1b35",
            border: "none", borderRadius: "6px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1, fontSize: "0.85rem",
          }}
        >
          {saving ? "…" : t("decisions.manual_pattern_save")}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "0.4rem 1rem", background: "rgba(255,255,255,0.07)", color: "inherit",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", fontWeight: 600,
            cursor: "pointer", fontSize: "0.85rem",
          }}
        >
          {t("decisions.btn_cancel")}
        </button>
      </div>
    </div>
  );
}

function PatternDisplay({ result, computedAt, hideTimestamp }: { result: PatternResult; computedAt: string; hideTimestamp?: boolean }) {
  const { t } = useTranslation();
  return (
    <div>
      {!hideTimestamp && (
        <div style={{ opacity: 0.35, fontSize: "0.78rem", marginBottom: "0.75rem" }}>
          {t("decisions.pattern_computed_at", { datetime: formatDateTime(computedAt) })}
        </div>
      )}

      {result.mistakes?.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontWeight: 600, color: "#ff5050", marginBottom: "0.4rem", fontSize: "0.88rem" }}>
            {t("decisions.summary.mistake_patterns")}
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {result.mistakes.map((p, i) => (
              <li key={i} style={{ marginBottom: "0.3rem", fontSize: "0.87rem" }}>
                {p.description} <span style={{ opacity: 0.45 }}>({p.count}×)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.successes?.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, color: "#50dc78", marginBottom: "0.4rem", fontSize: "0.88rem" }}>
            {t("decisions.summary.success_patterns")}
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {result.successes.map((p, i) => (
              <li key={i} style={{ marginBottom: "0.3rem", fontSize: "0.87rem" }}>
                {p.description} <span style={{ opacity: 0.45 }}>({p.count}×)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PatternCacheList({ caches, onRefresh }: { caches: PatternCacheEntry[]; onRefresh: () => void }) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<number>(caches[0]?.id);
  const [editId, setEditId] = useState<number | null>(null);
  const [editMistakes, setEditMistakes] = useState<PatternItem[]>([]);
  const [editSuccesses, setEditSuccesses] = useState<PatternItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  function startEdit(entry: PatternCacheEntry) {
    setEditId(entry.id);
    setEditMistakes(entry.result.mistakes.map((m) => ({ ...m })));
    setEditSuccesses(entry.result.successes.map((s) => ({ ...s })));
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function handleSaveEdit(id: number) {
    const mistakes = editMistakes.filter((m) => m.description.trim());
    const successes = editSuccesses.filter((s) => s.description.trim());
    setSaving(true);
    try {
      await updatePattern(id, { mistakes, successes });
      setEditId(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(t("decisions.pattern_delete_confirm"))) return;
    setDeleting(id);
    try {
      await deletePattern(id);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  function updateEditItem(
    list: PatternItem[], setList: (v: PatternItem[]) => void,
    index: number, field: keyof PatternItem, value: string | number
  ) {
    setList(list.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {caches.map((entry, idx) => {
        const isOpen = openId === entry.id;
        const isEditing = editId === entry.id;
        const isDeleting = deleting === entry.id;
        return (
          <div key={entry.id} style={{ borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", background: isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)" }}>
              <button
                onClick={() => { setOpenId(isOpen ? -1 : entry.id); if (isEditing) cancelEdit(); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.5rem 0.75rem", background: "none", border: "none",
                  color: "inherit", cursor: "pointer", fontSize: "0.82rem", textAlign: "left",
                }}
              >
                {idx === 0 && (
                  <span style={{ fontSize: "0.72rem", background: "rgba(245,200,66,0.2)", color: "#f5c842", borderRadius: "4px", padding: "0.1rem 0.4rem" }}>
                    mới nhất
                  </span>
                )}
                <span style={{ opacity: 0.6 }}>{formatDateTime(entry.computedAt)}</span>
                <span style={{ opacity: 0.4, marginLeft: "auto" }}>{isOpen ? "▲" : "▼"}</span>
              </button>
              {/* Edit / Delete buttons */}
              <div style={{ display: "flex", gap: "0.25rem", paddingRight: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
                {!isEditing && (
                  <button
                    onClick={() => { setOpenId(entry.id); startEdit(entry); }}
                    style={{ padding: "0.2rem 0.55rem", fontSize: "0.78rem", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "5px", color: "inherit", cursor: "pointer" }}
                  >
                    {t("decisions.btn_edit")}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={isDeleting}
                  style={{ padding: "0.2rem 0.55rem", fontSize: "0.78rem", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "5px", color: "#ff5050", cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.5 : 1 }}
                >
                  {t("decisions.btn_delete")}
                </button>
              </div>
            </div>

            {/* Body */}
            {isOpen && (
              <div style={{ padding: "0.75rem" }}>
                {isEditing ? (
                  <>
                    <PatternItemList
                      list={editMistakes} setList={setEditMistakes} color="#ff5050"
                      label={t("decisions.manual_pattern_mistakes")}
                      onUpdate={(i, f, v) => updateEditItem(editMistakes, setEditMistakes, i, f, v)}
                      onRemove={(i) => setEditMistakes(editMistakes.filter((_, idx) => idx !== i))}
                    />
                    <PatternItemList
                      list={editSuccesses} setList={setEditSuccesses} color="#50dc78"
                      label={t("decisions.manual_pattern_successes")}
                      onUpdate={(i, f, v) => updateEditItem(editSuccesses, setEditSuccesses, i, f, v)}
                      onRemove={(i) => setEditSuccesses(editSuccesses.filter((_, idx) => idx !== i))}
                    />
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button
                        onClick={() => handleSaveEdit(entry.id)}
                        disabled={saving}
                        style={{ padding: "0.35rem 0.9rem", background: "#50dc78", color: "#0f1b35", border: "none", borderRadius: "6px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontSize: "0.85rem" }}
                      >
                        {saving ? "…" : t("decisions.btn_save")}
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{ padding: "0.35rem 0.9rem", background: "rgba(255,255,255,0.07)", color: "inherit", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                      >
                        {t("decisions.btn_cancel")}
                      </button>
                    </div>
                  </>
                ) : (
                  <PatternDisplay result={entry.result} computedAt={entry.computedAt} hideTimestamp />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
