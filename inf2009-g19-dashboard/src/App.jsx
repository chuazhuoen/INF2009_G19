import { useState, useEffect, useCallback } from "react";

const API_URL = "https://yckgmb8guj.execute-api.us-east-1.amazonaws.com/status";

const POLL_INTERVAL = 5000;

function getStatusStyle(status) {
  switch (status) {
    case "OCCUPIED":
      return { bg: "#fee2e2", border: "#c53030", color: "#c53030", label: "Occupied", icon: "●" };
    case "CHOPE":
      return { bg: "#fffaf0", border: "#c05621", color: "#c05621", label: "Chope", icon: "◐" };
    case "VACANT":
      return { bg: "#f0fff4", border: "#2f855a", color: "#2f855a", label: "Vacant", icon: "○" };
    default:
      return { bg: "#f8fafc", border: "#94a3b8", color: "#94a3b8", label: "Unknown", icon: "?" };
  }
}

function timeAgo(ms) {
  if (!ms) return "never";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function noiseLabel(db) {
  if (!db || isNaN(db)) return null;
  if (db < 50) return { label: "Quiet",    color: "#2f855a" };
  if (db < 70) return { label: "Moderate", color: "#c05621" };
  return              { label: "Loud",     color: "#c53030" };
}

export default function App() {
  const [seats, setSeats] = useState({
    seat_1: { status: "UNKNOWN", noise_db: null, lastUpdated: null },
    seat_2: { status: "UNKNOWN", noise_db: null, lastUpdated: null },
  });
  const [fetchStatus, setFetchStatus] = useState("connecting");
  const [lastSync, setLastSync] = useState(null);
  const [, setTick] = useState(0);

  // Tick every second to keep "time ago" fresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const updated = { ...seats };
      data.forEach(item => {
        if (item.seatId in updated) {
          updated[item.seatId] = {
            status: item.occupancy_status ?? "UNKNOWN",
            noise_db: parseFloat(item.noise_db) || null,
            lastUpdated: Date.now(),
          };
        }
      });

      setSeats(updated);
      setLastSync(Date.now());
      setFetchStatus("live");
    } catch (err) {
      console.error("Fetch failed:", err);
      setFetchStatus("error");
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const noise = noiseLabel(seats.seat_1.noise_db);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; background: #eef2f6; color: #334155; font-family: 'Inter', sans-serif; }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.04);} }
      `}</style>

      <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── TOP BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 32px", borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: "#334155" }}>
              SIT Smart Study Space Monitor
            </h1>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
              INF2009 · G19 · Edge Computing and Analytics
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: fetchStatus === "live" ? "#2f855a" : fetchStatus === "error" ? "#c53030" : "#94a3b8",
              animation: fetchStatus === "live" ? "blink 2s infinite" : "none",
            }} />
            <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
              {fetchStatus === "live" ? "LIVE" : fetchStatus === "error" ? "ERROR" : "CONNECTING"}
            </span>
            {lastSync && (
              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                · updated {timeAgo(lastSync)}
              </span>
            )}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "40px 24px", gap: 40,
        }}>

          {/* Table label */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              Study Area · Table 1
            </p>
            <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
              Live seat detection via ultrasonic + camera
            </p>
          </div>

          {/* ── SEAT CARDS ── */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { key: "seat_1", label: "Seat 1" },
              { key: "seat_2", label: "Seat 2" },
            ].map(({ key, label }) => {
              const seat = seats[key];
              const s = getStatusStyle(seat.status);
              return (
                <div key={key} style={{
                  width: 220,
                  background: s.bg,
                  border: `2px solid ${s.border}`,
                  borderRadius: 16,
                  padding: "32px 24px",
                  textAlign: "center",
                  animation: seat.status !== "UNKNOWN" ? "pulse 3s ease-in-out infinite" : "none",
                  transition: "all 0.4s ease",
                }}>
                  {/* Chair icon area */}
                  <div style={{
                    fontSize: 48, lineHeight: 1,
                    color: s.color, marginBottom: 16,
                  }}>
                    {s.icon}
                  </div>

                  <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                    {label}
                  </p>

                  <p style={{
                    fontSize: 28, fontWeight: 700,
                    color: s.color, fontFamily: "'DM Mono', monospace",
                    lineHeight: 1, marginBottom: 12,
                  }}>
                    {s.label}
                  </p>

                  {seat.lastUpdated && (
                    <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                      updated {timeAgo(seat.lastUpdated)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── NOISE LEVEL ── */}
          {noise && seats.seat_1.noise_db && (
            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 12, padding: "20px 32px",
              textAlign: "center", minWidth: 240,
            }}>
              <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Ambient Noise
              </p>
              <p style={{ fontSize: 36, fontWeight: 700, color: noise.color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                {seats.seat_1.noise_db.toFixed(0)} <span style={{ fontSize: 16, fontWeight: 400 }}>dB</span>
              </p>
              <p style={{ fontSize: 13, color: noise.color, fontWeight: 600, marginTop: 6 }}>
                {noise.label}
              </p>
            </div>
          )}

          {/* ── LEGEND ── */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { status: "VACANT",   label: "Vacant"   },
              { status: "CHOPE",    label: "Chope (Reserved)" },
              { status: "OCCUPIED", label: "Occupied" },
            ].map(({ status, label }) => {
              const s = getStatusStyle(status);
              return (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: s.bg, border: `2px solid ${s.border}`,
                  }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
                </div>
              );
            })}
          </div>

        </div>

        {/* ── FOOTER ── */}
        <div style={{ padding: "14px 32px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
            INF2009 G19 · Singapore Institute of Technology · Edge Computing & Analytics
          </p>
        </div>

      </div>
    </>
  );
}