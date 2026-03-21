import { useState, useEffect, useCallback } from "react";

const API_URL = "https://yckgmb8guj.execute-api.us-east-1.amazonaws.com/status";
const POLL_INTERVAL = 5000;

// ── FAKE STATIC DATA FOR PODS 3–6 ──────────────────────────────────────────
const FAKE_PODS = [
  { id: "pod_3", name: "Pod 3", floor: "L3", status: "OCCUPIED", noise_db: 38, occupant: "In use" },
  { id: "pod_4", name: "Pod 4", floor: "L3", status: "VACANT",   noise_db: 22, occupant: null },
  { id: "pod_5", name: "Pod 5", floor: "L4", status: "CHOPE",    noise_db: 41, occupant: "Item left on seat" },
  { id: "pod_6", name: "Pod 6", floor: "L4", status: "OCCUPIED", noise_db: 55, occupant: "In use" },
];

const STATUS = {
  OCCUPIED: { label: "Occupied",  bg: "#fff1f1", border: "#e53e3e", text: "#c53030", dot: "#e53e3e", badge: "#fed7d7" },
  CHOPE:    { label: "Reserved",  bg: "#fffbeb", border: "#d97706", text: "#b45309", dot: "#f59e0b", badge: "#fef3c7" },
  VACANT:   { label: "Available", bg: "#f0fdf4", border: "#16a34a", text: "#15803d", dot: "#22c55e", badge: "#dcfce7" },
  UNKNOWN:  { label: "Offline",   bg: "#f8fafc", border: "#94a3b8", text: "#64748b", dot: "#94a3b8", badge: "#f1f5f9" },
};

function timeAgo(ms) {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function NoiseBar({ db }) {
  if (!db) return null;
  const pct = Math.min(100, Math.max(0, ((db - 20) / 80) * 100));
  const color = db < 50 ? "#16a34a" : db < 70 ? "#d97706" : "#e53e3e";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>Noise</span>
        <span style={{ fontSize: 10, color, fontFamily: "monospace", fontWeight: 600 }}>{db.toFixed(0)} dB</span>
      </div>
      <div style={{ background: "#e2e8f0", borderRadius: 99, height: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function PodCard({ pod, isLive }) {
  const s = STATUS[pod.status] ?? STATUS.UNKNOWN;
  return (
    <div style={{
      background: s.bg,
      border: `1.5px solid ${s.border}`,
      borderRadius: 14,
      padding: "20px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      transition: "all 0.4s ease",
      position: "relative",
      overflow: "hidden",
    }}>
      {isLive && (
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 0 2px #bbf7d0",
            animation: "livePulse 2s infinite",
          }} />
          <span style={{ fontSize: 9, color: "#16a34a", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em" }}>LIVE</span>
        </div>
      )}

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: 0 }}>{pod.name}</p>
        <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>{pod.floor} · 1 seat</p>
      </div>

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: s.badge, borderRadius: 99,
        padding: "4px 10px", width: "fit-content",
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: s.text, letterSpacing: "0.04em" }}>{s.label}</span>
      </div>

      <NoiseBar db={pod.noise_db} />

      <div style={{ marginTop: 2 }}>
        {pod.occupant && (
          <p style={{ fontSize: 10, color: "#64748b", fontStyle: "italic" }}>{pod.occupant}</p>
        )}
        {pod.lastUpdated && (
          <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>
            Updated {timeAgo(pod.lastUpdated)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [livePods, setLivePods] = useState({
    seat_1: { id: "seat_1", name: "Pod 1", floor: "L3", status: "UNKNOWN", noise_db: null, lastUpdated: null, occupant: null },
    seat_2: { id: "seat_2", name: "Pod 2", floor: "L3", status: "UNKNOWN", noise_db: null, lastUpdated: null, occupant: null },
  });
  const [fetchStatus, setFetchStatus] = useState("connecting");
  const [lastSync, setLastSync] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setLivePods(prev => {
        const updated = { ...prev };
        data.forEach(item => {
          if (item.seatId in updated) {
            updated[item.seatId] = {
              ...updated[item.seatId],
              status: item.occupancy_status ?? "UNKNOWN",
              noise_db: parseFloat(item.noise_db) || null,
              lastUpdated: Date.now(),
              occupant: item.occupancy_status === "OCCUPIED" ? "Sensor detected" :
                        item.occupancy_status === "CHOPE"    ? "Item left on seat" : null,
            };
          }
        });
        return updated;
      });

      setLastSync(Date.now());
      setFetchStatus("live");
    } catch (err) {
      console.error("Fetch failed:", err);
      setFetchStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const allPods = [
    { ...livePods.seat_1, isLive: true },
    { ...livePods.seat_2, isLive: true },
    ...FAKE_PODS.map(p => ({ ...p, isLive: false, lastUpdated: null })),
  ];

  const counts = allPods.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; background: #f0f4f8; font-family: 'Syne', sans-serif; color: #1e293b; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        @keyframes livePulse { 0%,100%{box-shadow:0 0 0 2px #bbf7d0;} 50%{box-shadow:0 0 0 4px #86efac;} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
        @media (max-width: 700px) {
          .pod-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .summary-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .main-pad { padding: 20px 16px !important; }
        }
      `}</style>

      <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── HEADER ── */}
        <div style={{ background: "#0f172a", padding: "0 32px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 0", borderBottom: "1px solid #1e293b",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: "#e53e3e",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>SIT</span>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", margin: 0 }}>Study Space Finder</p>
                <p style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", marginTop: 1 }}>INF2009 · G19 · Edge Computing</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: fetchStatus === "live" ? "#22c55e" : fetchStatus === "error" ? "#e53e3e" : "#94a3b8",
                  animation: fetchStatus === "live" ? "livePulse 2s infinite" : "none",
                }} />
                <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
                  {fetchStatus === "live" ? "LIVE" : fetchStatus === "error" ? "ERROR" : "CONNECTING"}
                </span>
              </div>
              {lastSync && (
                <span style={{ fontSize: 11, color: "#334155", fontFamily: "'DM Mono', monospace" }}>
                  synced {timeAgo(lastSync)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div className="main-pad" style={{ flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 900, margin: "0 auto", width: "100%" }}>

          {/* ── SUMMARY ── */}
          <div className="summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, animation: "fadeUp 0.4s ease" }}>
            {[
              { label: "Available", count: counts.VACANT   ?? 0, color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
              { label: "Reserved",  count: counts.CHOPE    ?? 0, color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
              { label: "Occupied",  count: counts.OCCUPIED ?? 0, color: "#c53030", bg: "#fff1f1", border: "#fecaca" },
            ].map(stat => (
              <div key={stat.label} style={{
                background: stat.bg, border: `1px solid ${stat.border}`,
                borderRadius: 10, padding: "14px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{stat.label}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: stat.color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                  {stat.count}
                </span>
              </div>
            ))}
          </div>

          {/* ── PODS ── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Study Pods · Level 3 & 4
              </p>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                Pods 1–2 live · Pods 3–6 simulated
              </span>
            </div>

            <div className="pod-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, animation: "fadeUp 0.5s ease" }}>
              {allPods.map(pod => (
                <PodCard key={pod.id} pod={pod} isLive={pod.isLive} />
              ))}
            </div>
          </div>

          {/* ── LEGEND ── */}
          <div style={{
            display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center",
            padding: "14px 18px", background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
          }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Legend</span>
            {Object.entries(STATUS).filter(([k]) => k !== "UNKNOWN").map(([key, s]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot }} />
                <span style={{ fontSize: 11, color: "#475569" }}>{s.label}</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px #bbf7d0" }} />
              <span style={{ fontSize: 11, color: "#475569" }}>Live sensor data</span>
            </div>
          </div>

        </div>

        {/* ── FOOTER ── */}
        <div style={{ padding: "12px 32px", borderTop: "1px solid #e2e8f0", background: "#fff" }}>
          <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
            INF2009 G19 · Singapore Institute of Technology · Edge Computing & Analytics · Pods 1–2 powered by Raspberry Pi sensors
          </p>
        </div>

      </div>
    </>
  );
}