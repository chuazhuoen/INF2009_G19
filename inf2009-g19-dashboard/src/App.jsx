import { useState, useEffect, useCallback } from "react";

const API_URL = "https://yckgmb8guj.execute-api.us-east-1.amazonaws.com/status";

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_DATA = {
  rooms: [
    {
      id: "room-a", name: "Study Room A", floor: "Level 3",
      occupied: 0, reserved: 0, vacant: 2, total: 2,
      noise: { db: 42, label: "Quiet", trend: "stable" },
      lastUpdated: Date.now() - 8000,
      isLive: true,
    },
    {
      id: "room-b", name: "Study Room B", floor: "Level 3",
      occupied: 5, reserved: 2, vacant: 5, total: 12,
      noise: { db: 67, label: "Moderate", trend: "rising" },
      lastUpdated: Date.now() - 4000,
      isLive: false,
    },
    {
      id: "room-c", name: "Discussion Room A", floor: "Level 4",
      occupied: 4, reserved: 1, vacant: 1, total: 6,
      noise: { db: 81, label: "Loud", trend: "falling" },
      lastUpdated: Date.now() - 12000,
      isLive: false,
    },
    {
      id: "room-d", name: "Discussion Room B", floor: "Level 5",
      occupied: 2, reserved: 3, vacant: 7, total: 12,
      noise: { db: 28, label: "Quiet", trend: "stable" },
      lastUpdated: Date.now() - 2000,
      isLive: false,
    },
    {
      id: "room-e", name: "Discussion Room C", floor: "Level 5",
      occupied: 3, reserved: 1, vacant: 4, total: 8,
      noise: { db: 45, label: "Quiet", trend: "stable" },
      lastUpdated: Date.now() - 2000,
      isLive: false,
    },
  ],
  lastSync: Date.now(),
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function noiseLevel(db) {
  if (db < 50) return { label: "Quiet",    color: "#2f855a" };
  if (db < 70) return { label: "Moderate", color: "#c05621" };
  return              { label: "Loud",     color: "#c53030" };
}

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function simulateLiveUpdate(data) {
  return {
    ...data,
    lastSync: Date.now(),
    rooms: data.rooms.map(room => {
      if (room.isLive) return room; // don't simulate live room
      return {
        ...room,
        noise: {
          ...room.noise,
          db: Math.max(20, Math.min(100, room.noise.db + (Math.random() * 4 - 2))),
        },
        lastUpdated: Math.random() > 0.7 ? Date.now() - Math.random() * 3000 : room.lastUpdated,
      };
    }),
  };
}

// ─── NOISE METER ──────────────────────────────────────────────────────────────
function NoiseMeter({ noise }) {
  const nl = noiseLevel(noise.db);
  const pct = Math.min(100, Math.max(0, ((noise.db - 20) / 80) * 100));
  const trendChar = noise.trend === "rising" ? "↑" : noise.trend === "falling" ? "↓" : "—";

  return (
    <div>
      <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        Ambient Noise
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: nl.color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
          {noise.db.toFixed(0)}
        </span>
        <span style={{ fontSize: 13, color: "#64748b" }}>dB</span>
        <span style={{ fontSize: 13, color: nl.color, marginLeft: 2 }}>{trendChar}</span>
        <span style={{ fontSize: 12, color: nl.color, marginLeft: 4, fontWeight: 600 }}>{nl.label}</span>
      </div>
      <div style={{ background: "#e2e8f0", borderRadius: 4, height: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: nl.color,
          borderRadius: 4, transition: "width 1s cubic-bezier(0.4,0,0.2,1)", opacity: 0.8,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>20 dB</span>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>100 dB</span>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data,         setData]         = useState(MOCK_DATA);
  const [selectedRoom, setSelectedRoom] = useState("room-a");
  const [isLive,       setIsLive]       = useState(true);
  const [fetchStatus,  setFetchStatus]  = useState("connecting");
  const [,             setTick]         = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("API error");
      const apiData = await res.json();

      // Find study_area_A from response
      const area = apiData.find(item => item.studyarea_id === "study_area_A");

      setData(prev => ({
        ...prev,
        lastSync: Date.now(),
        rooms: prev.rooms.map(room => {
          if (room.id !== "room-a") {
            // Simulate other rooms
            return {
              ...room,
              noise: {
                ...room.noise,
                db: Math.max(20, Math.min(100, room.noise.db + (Math.random() * 4 - 2))),
              },
            };
          }

          // Wire real data into Study Room A
          if (!area) return room;

          const noiseDb = parseFloat(area.noise_level) || room.noise.db;
          return {
            ...room,
            occupied: area.occupied_seats ?? 0,
            reserved: area.reserved_seats ?? 0,
            vacant:   area.empty_seats    ?? 0,
            total:    (area.occupied_seats ?? 0) + (area.reserved_seats ?? 0) + (area.empty_seats ?? 0),
            lastUpdated: Date.now(),
            noise: {
              db: noiseDb,
              label: noiseDb < 50 ? "Quiet" : noiseDb < 70 ? "Moderate" : "Loud",
              trend: "stable",
            },
          };
        }),
      }));

      setFetchStatus("live");
    } catch (err) {
      console.error("Fetch failed, falling back to simulation:", err);
      setData(prev => simulateLiveUpdate(prev));
      setFetchStatus("error");
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [isLive, fetchData]);

  const room = data.rooms.find(r => r.id === selectedRoom) ?? data.rooms[0];

  const totals = data.rooms.reduce(
    (acc, r) => ({
      vacant:   acc.vacant   + r.vacant,
      reserved: acc.reserved + r.reserved,
      occupied: acc.occupied + r.occupied,
      total:    acc.total    + r.total,
    }),
    { vacant: 0, reserved: 0, occupied: 0, total: 0 }
  );

  const bestRoom = [...data.rooms].sort((a, b) => {
    const score = r => r.vacant * 10 - r.noise.db;
    return score(b) - score(a);
  })[0];
  const bestNoise = noiseLevel(bestRoom.noise.db);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Inter:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; background: #eef2f6; color: #334155; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
        .room-tab:hover { background: #f1f5f9 !important; }
      `}</style>

      <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── TOP BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 32px", borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: "#334155" }}>SIT Smart Study Space Monitor</h1>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 1, fontFamily: "'DM Mono', monospace" }}>
              INF2009 · G19 · Edge Computing and Analytics
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <p style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
              Updated {timeAgo(data.lastSync)}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: fetchStatus === "error" ? "#c53030" : fetchStatus === "live" ? "#2f855a" : "#94a3b8",
                animation: isLive ? "blink 2s infinite" : "none",
              }} />
              <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
                {fetchStatus === "live" ? "LIVE" : fetchStatus === "error" ? "ERROR" : "CONNECTING"}
              </span>
            </div>
            <button
              onClick={() => setIsLive(l => !l)}
              style={{
                background: "transparent", border: "1px solid #cbd5e1",
                borderRadius: 6, padding: "5px 12px", color: "#475569",
                fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}
            >
              {isLive ? "Pause" : "Resume"}
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── SUMMARY STATS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Total Seats",  value: totals.total,    sub: "across all rooms", color: "#334155" },
              { label: "Vacant",       value: totals.vacant,   sub: "available now",    color: "#2f855a" },
              { label: "Occupied",     value: totals.occupied, sub: "in use",           color: "#c53030" },
              { label: "Reserved",     value: totals.reserved, sub: "temporarily held", color: "#c05621" },
            ].map(stat => (
              <div key={stat.label} style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: "18px 20px",
              }}>
                <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{stat.label}</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: stat.color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{stat.value}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, fontFamily: "'DM Mono', monospace" }}>{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* ── RECOMMENDATION ── */}
          <div style={{
            background: "#f1f5f9", border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "18px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                Best Available Spot
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#334155" }}>{bestRoom.name}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{bestRoom.floor}</span>
              </div>
              <p style={{ fontSize: 12, color: "#475569", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                {bestRoom.vacant} vacant · noise <span style={{ color: bestNoise.color }}>{bestNoise.label.toLowerCase()}</span> at {bestRoom.noise.db.toFixed(0)} dB
              </p>
            </div>
            <button
              onClick={() => setSelectedRoom(bestRoom.id)}
              style={{
                background: "#f8fafc", border: "1px solid #cbd5e1",
                borderRadius: 6, padding: "8px 18px", color: "#334155",
                fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}
            >
              View room
            </button>
          </div>

          {/* ── ROOM TABS ── */}
          <div>
            <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              Rooms
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {data.rooms.map(r => {
                const nl = noiseLevel(r.noise.db);
                const isSelected = r.id === selectedRoom;
                const pct = r.total > 0 ? Math.round((r.occupied / r.total) * 100) : 0;

                return (
                  <div
                    key={r.id}
                    className="room-tab"
                    onClick={() => setSelectedRoom(r.id)}
                    style={{
                      background: isSelected ? "#eef2f6" : "#f8fafc",
                      border: `1px solid ${isSelected ? "#64748b" : "#e2e8f0"}`,
                      borderRadius: 10, padding: "16px 18px",
                      cursor: "pointer", transition: "all 0.2s ease",
                      position: "relative",
                    }}
                  >
                    {/* Live badge */}
                    {r.isLive && (
                      <div style={{
                        position: "absolute", top: 10, right: 10,
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <div style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: "#2f855a",
                          animation: "blink 2s infinite",
                        }} />
                        <span style={{ fontSize: 9, color: "#2f855a", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>LIVE</span>
                      </div>
                    )}

                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: isSelected ? "#334155" : "#475569", margin: 0 }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: "#64748b", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{r.floor}</p>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: nl.color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{nl.label}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{r.noise.db.toFixed(0)} dB</span>
                    </div>

                    <div style={{ background: "#e2e8f0", borderRadius: 2, height: 4, marginBottom: 8 }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, borderRadius: 2,
                        background: pct > 80 ? "#c53030" : pct > 50 ? "#c05621" : "#2f855a",
                        transition: "width 0.6s ease",
                      }} />
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "#2f855a", fontFamily: "'DM Mono', monospace" }}>{r.vacant} free</span>
                      <span style={{ fontSize: 11, color: "#c05621", fontFamily: "'DM Mono', monospace" }}>{r.reserved} reserved</span>
                      <span style={{ fontSize: 11, color: "#c53030", fontFamily: "'DM Mono', monospace" }}>{r.occupied} occupied</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── ROOM DETAIL (no seat map) ── */}
          <div
            key={selectedRoom}
            style={{
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 10, padding: "24px 28px",
              animation: "fadeIn 0.25s ease",
            }}
          >
            {/* Room header */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              flexWrap: "wrap", gap: 12, marginBottom: 28,
              paddingBottom: 20, borderBottom: "1px solid #e2e8f0",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: "#334155" }}>{room.name}</h2>
                  {room.isLive && (
                    <span style={{
                      fontSize: 10, color: "#2f855a", fontFamily: "'DM Mono', monospace",
                      fontWeight: 700, background: "#f0fff4", border: "1px solid #c6f6d5",
                      borderRadius: 99, padding: "2px 8px",
                    }}>LIVE</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                  {room.floor} · last updated {timeAgo(room.lastUpdated)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { value: room.vacant,   label: "Vacant",   color: "#2f855a" },
                  { value: room.reserved, label: "Reserved", color: "#c05621" },
                  { value: room.occupied, label: "Occupied", color: "#c53030" },
                  { value: room.total,    label: "Total",    color: "#334155" },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 24, fontWeight: 700, color: item.color, margin: 0, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{item.value}</p>
                    <p style={{ fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Noise + stats side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
              <NoiseMeter noise={room.noise} />

              <div>
                <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                  Occupancy
                </p>
                <div style={{ background: "#e2e8f0", borderRadius: 4, height: 6, marginBottom: 8 }}>
                  <div style={{
                    height: "100%",
                    width: `${room.total > 0 ? Math.round((room.occupied / room.total) * 100) : 0}%`,
                    background: "#2f855a", borderRadius: 4,
                    transition: "width 0.8s ease", opacity: 0.8,
                  }} />
                </div>
                <p style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
                  {room.occupied} / {room.total} seats in use ({room.total > 0 ? Math.round((room.occupied / room.total) * 100) : 0}%)
                </p>

                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    Suitability
                  </p>
                  {(() => {
                    const nl = noiseLevel(room.noise.db);
                    const freeRatio = room.total > 0 ? room.vacant / room.total : 0;
                    let verdict = "Not recommended";
                    let color   = "#c53030";
                    if (freeRatio > 0.4 && room.noise.db < 50) { verdict = "Good for solo study"; color = "#2f855a"; }
                    else if (freeRatio > 0.2 && room.noise.db < 70) { verdict = "Acceptable"; color = "#c05621"; }
                    return (
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color }}>{verdict}</p>
                        <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                          {room.vacant} free · {nl.label.toLowerCase()} noise
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── FOOTER ── */}
        <div style={{ padding: "14px 32px", borderTop: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
            INF2009 G19 · Singapore Institute of Technology · Edge Computing & Analytics · Study Room A powered by Raspberry Pi sensors
          </p>
        </div>

      </div>
    </>
  );
}