import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// CONFIG: Replace this with your published Google Sheet CSV URL
// In Google Sheets: File → Share → Publish to web → CSV
// ─────────────────────────────────────────────────────────────
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzYGKfOoIAHIe8mklIihfRnzhXpfx5RgGYhYwVNGTwyEJQLOc7HtnIs1R5sPYhv3gbGyfKOH1IleV8/pub?gid=0&single=true&output=csv";
// Example: "https://docs.google.com/spreadsheets/d/e/2PACX-xxxxx/pub?output=csv"

// ─────────────────────────────────────────────────────────────
// DEMO DATA (used when no Google Sheet URL is configured)
// Your Google Sheet should have these exact column headers:
// client_code | client_name | group_code | return_name | return_type | year | status | percent_complete | preparer | last_updated | message
// ─────────────────────────────────────────────────────────────
const DEMO_DATA = [
  { client_code: "TXR-4821", client_name: "Sarah Mitchell", group_code: "", return_name: "Sarah Mitchell – Individual", return_type: "Individual", year: "2025", status: "Under Review", percent_complete: "75", preparer: "James Carter, CPA", last_updated: "2026-03-08", message: "We're reviewing your investment income documents. Expected completion by March 15." },
  { client_code: "TXR-4821", client_name: "Sarah Mitchell", group_code: "", return_name: "Mitchell Family Trust", return_type: "Trust", year: "2025", status: "In Progress", percent_complete: "40", preparer: "James Carter, CPA", last_updated: "2026-03-06", message: "Trust documents received. Currently reconciling distributions." },
  { client_code: "TXR-7733", client_name: "David & Elena Ross", group_code: "GRP-ROSS", return_name: "David & Elena Ross – Joint Return", return_type: "Joint Individual", year: "2025", status: "Filed with ATO", percent_complete: "100", preparer: "Amina Patel, CPA", last_updated: "2026-03-01", message: "Your return has been lodged with the ATO. Refund expected within 14 business days." },
  { client_code: "TXR-7733", client_name: "David & Elena Ross", group_code: "GRP-ROSS", return_name: "Ross Consulting Pty Ltd", return_type: "Company", year: "2025", status: "Awaiting Documents", percent_complete: "15", preparer: "Amina Patel, CPA", last_updated: "2026-03-05", message: "We still need the Q4 BAS reconciliation and bank statements. Please upload at your earliest convenience." },
  { client_code: "TXR-7733", client_name: "David & Elena Ross", group_code: "GRP-ROSS", return_name: "Ross Family SMSF", return_type: "SMSF", year: "2025", status: "In Progress", percent_complete: "55", preparer: "Amina Patel, CPA", last_updated: "2026-03-07", message: "Audit engagement letter sent. Fund financials are being prepared." },
  { client_code: "TXR-1090", client_name: "Horizon Ventures Ltd", group_code: "", return_name: "Horizon Ventures Ltd", return_type: "Company", year: "2025", status: "Documents Received", percent_complete: "25", preparer: "Li Wei, CA", last_updated: "2026-03-09", message: "All documents received. We'll begin preparation this week." },
  { client_code: "DEMO", client_name: "Demo Client", group_code: "", return_name: "Demo Individual Return", return_type: "Individual", year: "2025", status: "In Progress", percent_complete: "60", preparer: "Your Accountant", last_updated: "2026-03-10", message: "This is a demo entry. Try codes: TXR-4821, TXR-7733, TXR-1090" },
];

// ─────────────────────────────────────────────────────────────
// CSV Parser
// ─────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const vals = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { vals.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    vals.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
}

// ─────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  "Awaiting Documents": { color: "#D97706", bg: "#FEF3C7", icon: "📋", step: 1 },
  "Documents Received": { color: "#2563EB", bg: "#DBEAFE", icon: "📥", step: 2 },
  "In Progress":        { color: "#7C3AED", bg: "#EDE9FE", icon: "⚙️", step: 3 },
  "Under Review":       { color: "#EA580C", bg: "#FFF7ED", icon: "🔍", step: 4 },
  "Filed with ATO":     { color: "#059669", bg: "#D1FAE5", icon: "✅", step: 5 },
  "Complete":           { color: "#059669", bg: "#D1FAE5", icon: "✅", step: 5 },
};
const STEPS = ["Awaiting Documents", "Documents Received", "In Progress", "Under Review", "Filed"];
const getStatusConfig = (s) => STATUS_CONFIG[s] || { color: "#6B7280", bg: "#F3F4F6", icon: "📄", step: 0 };

// ─────────────────────────────────────────────────────────────
// Firm config (customize these)
// ─────────────────────────────────────────────────────────────
const FIRM = {
  name: "mayatax",
  tagline: "Chartered Accountants & Tax Advisors",
  phone: "(832) 460 4210",
  email: "moiz.majeed@mayatax.com",
};

// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────
export default function TaxStatusTracker() {
  const [screen, setScreen] = useState("landing");
  const [code, setCode] = useState("");
  const [results, setResults] = useState([]);
  const [clientName, setClientName] = useState("");
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);
  const inputRef = useRef(null);

  // Load data from Google Sheets or fall back to demo
  useEffect(() => {
    async function loadData() {
      if (!GOOGLE_SHEET_CSV_URL) {
        setAllData(DEMO_DATA);
        setDataLoaded(true);
        return;
      }
      try {
        const res = await fetch(GOOGLE_SHEET_CSV_URL);
        const text = await res.text();
        const parsed = parseCSV(text);
        setAllData(parsed.length > 0 ? parsed : DEMO_DATA);
      } catch {
        setAllData(DEMO_DATA);
      }
      setDataLoaded(true);
    }
    loadData();
  }, []);

  const handleLookup = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 500);
      return;
    }
    setLoading(true);
    setError("");
    setTimeout(() => {
      const matches = allData.filter((r) => r.client_code?.toUpperCase() === trimmed);
      if (matches.length === 0) {
        setError("No returns found for this code. Please check and try again.");
        setShakeInput(true);
        setTimeout(() => setShakeInput(false), 500);
      } else {
        setResults(matches);
        setClientName(matches[0].client_name || "Client");
        setScreen("results");
      }
      setLoading(false);
    }, 600);
  };

  const handleBack = () => {
    setScreen("landing");
    setCode("");
    setResults([]);
    setError("");
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleLookup(); };

  // ─── STYLES ───
  const fonts = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');`;

  const baseStyle = {
    fontFamily: "'DM Sans', sans-serif",
    minHeight: "100vh",
    background: "#FAFAF8",
    color: "#1a1a1a",
  };

  // ─── LANDING SCREEN ───
  if (screen === "landing") {
    return (
      <div style={baseStyle}>
        <style>{fonts}{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
          .fade-up { animation: fadeUp 0.6s ease forwards; opacity:0; }
          .d1 { animation-delay: 0.1s; } .d2 { animation-delay: 0.2s; } .d3 { animation-delay: 0.3s; } .d4 { animation-delay: 0.4s; }
          .shake { animation: shake 0.4s ease; }
          .code-input:focus { outline:none; border-color:#1a1a1a !important; box-shadow: 0 0 0 3px rgba(26,26,26,0.08); }
          .lookup-btn { transition: all 0.2s ease; }
          .lookup-btn:hover { background:#333 !important; transform:translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .lookup-btn:active { transform:translateY(0); }
        `}</style>

        {/* Top bar */}
        <div style={{ borderBottom: "1px solid #E8E6E1", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "white" }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{FIRM.name}</div>
            <div style={{ fontSize: 11, color: "#888", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 }}>{FIRM.tagline}</div>
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>{FIRM.phone}</div>
        </div>

        {/* Hero */}
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px 40px", textAlign: "center" }}>
          {/* Decorative line */}
          <div className="fade-up d1" style={{ width: 40, height: 3, background: "#1a1a1a", margin: "0 auto 32px", borderRadius: 2 }} />

          <h1 className="fade-up d1" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, fontWeight: 400, lineHeight: 1.2, marginBottom: 12, letterSpacing: "-0.02em" }}>
            Tax Return Status
          </h1>
          <p className="fade-up d2" style={{ fontSize: 16, color: "#666", lineHeight: 1.6, marginBottom: 48, maxWidth: 400, margin: "0 auto 48px" }}>
            Enter your unique client code to view the real-time progress of your tax return.
          </p>

          {/* Input group */}
          <div className={`fade-up d3 ${shakeInput ? "shake" : ""}`} style={{ maxWidth: 400, margin: "0 auto" }}>
            <label style={{ display: "block", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", marginBottom: 8 }}>
              Your Client Code
            </label>
            <input
              ref={inputRef}
              className="code-input"
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. TXR-4821"
              style={{
                width: "100%", padding: "16px 20px", fontSize: 18, fontFamily: "'DM Sans', monospace",
                fontWeight: 600, letterSpacing: "0.08em", border: "2px solid #E0DED8",
                borderRadius: 12, background: "white", color: "#1a1a1a", textAlign: "center",
                boxSizing: "border-box", transition: "all 0.2s ease",
              }}
            />
            {error && (
              <div style={{ marginTop: 12, padding: "10px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626", textAlign: "left" }}>
                {error}
              </div>
            )}
            <button
              className="lookup-btn"
              onClick={handleLookup}
              disabled={loading}
              style={{
                width: "100%", marginTop: 16, padding: "16px", fontSize: 15, fontWeight: 600,
                background: "#1a1a1a", color: "white", border: "none", borderRadius: 12,
                cursor: loading ? "wait" : "pointer", letterSpacing: "0.02em",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Looking up…" : "View My Returns"}
            </button>
          </div>

          {/* Demo hint */}
          {!GOOGLE_SHEET_CSV_URL && (
            <div className="fade-up d4" style={{ marginTop: 40, padding: "16px 20px", background: "#F0EFEB", borderRadius: 10, fontSize: 13, color: "#777", lineHeight: 1.5 }}>
              <strong style={{ color: "#555" }}>Demo Mode</strong> — Try codes: <code style={{ background: "#E8E6E1", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>DEMO</code>{" "}
              <code style={{ background: "#E8E6E1", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>TXR-4821</code>{" "}
              <code style={{ background: "#E8E6E1", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>TXR-7733</code>{" "}
              <code style={{ background: "#E8E6E1", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>TXR-1090</code>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px", textAlign: "center", fontSize: 12, color: "#aaa", borderTop: "1px solid #EEEDEA", background: "#FAFAF8" }}>
          {FIRM.name} · {FIRM.email} · Secure & Confidential
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ───
  const isGroup = results.length > 1;
  const overallPercent = Math.round(results.reduce((sum, r) => sum + (parseInt(r.percent_complete) || 0), 0) / results.length);

  return (
    <div style={baseStyle}>
      <style>{fonts}{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes growWidth { from { width:0%; } }
        .fade-up { animation: fadeUp 0.5s ease forwards; opacity:0; }
        .d1{animation-delay:.05s} .d2{animation-delay:.15s} .d3{animation-delay:.25s} .d4{animation-delay:.35s} .d5{animation-delay:.45s} .d6{animation-delay:.55s}
        .back-btn { transition: all 0.15s ease; }
        .back-btn:hover { background:#F0EFEB !important; }
        .card { transition: all 0.2s ease; }
        .card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
        .progress-fill { animation: growWidth 1s ease forwards; }
      `}</style>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #E8E6E1", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="back-btn" onClick={handleBack} style={{ background: "none", border: "1px solid #E0DED8", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#555" }}>
            ← Back
          </button>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#1a1a1a" }}>{FIRM.name}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#999", textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: "#555" }}>{clientName}</div>
          <div>Code: {code}</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Header */}
        <div className="fade-up d1" style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, fontWeight: 400, marginBottom: 4, letterSpacing: "-0.02em" }}>
            {isGroup ? `${clientName} — Group Overview` : "Your Tax Return"}
          </h1>
          <p style={{ fontSize: 14, color: "#888" }}>
            {isGroup ? `${results.length} returns in your group` : results[0]?.return_name}
          </p>
        </div>

        {/* Overall progress (for groups) */}
        {isGroup && (
          <div className="fade-up d2" style={{ background: "white", border: "1px solid #E8E6E1", borderRadius: 14, padding: "24px 28px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>Overall Group Progress</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{overallPercent}%</span>
            </div>
            <div style={{ height: 8, background: "#F0EFEB", borderRadius: 4, overflow: "hidden" }}>
              <div className="progress-fill" style={{ height: "100%", width: `${overallPercent}%`, background: "linear-gradient(90deg, #1a1a1a, #444)", borderRadius: 4 }} />
            </div>
          </div>
        )}

        {/* Return cards */}
        {results.map((r, i) => {
          const sc = getStatusConfig(r.status);
          const pct = parseInt(r.percent_complete) || 0;
          const currentStep = sc.step;
          const delayClass = `d${Math.min(i + (isGroup ? 3 : 2), 6)}`;

          return (
            <div key={i} className={`card fade-up ${delayClass}`} style={{ background: "white", border: "1px solid #E8E6E1", borderRadius: 14, padding: "28px", marginBottom: 20 }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 400, margin: 0, lineHeight: 1.3 }}>{r.return_name}</h2>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#F0EFEB", color: "#666", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {r.return_type}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#F0EFEB", color: "#666" }}>
                      FY {r.year}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: sc.bg, flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>{sc.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: sc.color }}>{r.status}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#999", fontWeight: 500 }}>Completion</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{pct}%</span>
                </div>
                <div style={{ height: 6, background: "#F0EFEB", borderRadius: 3, overflow: "hidden" }}>
                  <div className="progress-fill" style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${sc.color}, ${sc.color}cc)`, borderRadius: 3 }} />
                </div>
              </div>

              {/* Steps indicator */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, padding: "0 4px" }}>
                {STEPS.map((step, si) => {
                  const isActive = si < currentStep;
                  const isCurrent = si === currentStep - 1;
                  return (
                    <div key={si} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative" }}>
                      <div style={{
                        width: isCurrent ? 14 : 10, height: isCurrent ? 14 : 10,
                        borderRadius: "50%", background: isActive ? sc.color : "#E0DED8",
                        border: isCurrent ? `3px solid ${sc.bg}` : "none",
                        boxShadow: isCurrent ? `0 0 0 2px ${sc.color}` : "none",
                        transition: "all 0.3s ease",
                      }} />
                      <span style={{ fontSize: 9, color: isActive ? sc.color : "#bbb", marginTop: 6, textAlign: "center", fontWeight: isActive ? 600 : 400, lineHeight: 1.2 }}>
                        {step}
                      </span>
                      {si < STEPS.length - 1 && (
                        <div style={{
                          position: "absolute", top: 5, left: "60%", right: "-40%", height: 2,
                          background: isActive && si < currentStep - 1 ? sc.color : "#E8E6E1",
                          zIndex: 0,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Message */}
              {r.message && (
                <div style={{ padding: "16px 20px", background: "#FAFAF8", borderRadius: 10, border: "1px solid #EEEDEA", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginBottom: 6 }}>Message from your accountant</div>
                  <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: 0 }}>{r.message}</p>
                </div>
              )}

              {/* Meta */}
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>Preparer: <strong style={{ color: "#666" }}>{r.preparer}</strong></span>
                <span style={{ fontSize: 12, color: "#aaa" }}>Updated: <strong style={{ color: "#666" }}>{r.last_updated}</strong></span>
              </div>
            </div>
          );
        })}

        {/* Help section */}
        <div className={`fade-up d${Math.min(results.length + 3, 6)}`} style={{ marginTop: 12, padding: "20px 24px", background: "#F7F6F3", borderRadius: 12, border: "1px solid #EEEDEA", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#777", margin: 0, lineHeight: 1.6 }}>
            Questions about your return? Contact us at{" "}
            <strong style={{ color: "#1a1a1a" }}>{FIRM.phone}</strong> or{" "}
            <strong style={{ color: "#1a1a1a" }}>{FIRM.email}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
