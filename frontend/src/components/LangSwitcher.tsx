import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "vi", label: "VI" },
  { code: "en", label: "EN" },
  { code: "ja", label: "日本語" },
] as const;

export function LangSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  function change(code: string) {
    i18n.changeLanguage(code);
    localStorage.setItem("lang", code);
  }

  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center", marginLeft: "auto", padding: "0 1rem" }}>
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => change(code)}
          style={{
            padding: "4px 10px",
            fontSize: "0.72rem",
            fontWeight: current === code ? 700 : 400,
            background: current === code ? "rgba(245,200,66,0.15)" : "transparent",
            border: current === code ? "1px solid rgba(245,200,66,0.45)" : "1px solid rgba(255,255,255,0.12)",
            color: current === code ? "#f5c842" : "rgba(200,215,255,0.55)",
            borderRadius: "6px",
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
