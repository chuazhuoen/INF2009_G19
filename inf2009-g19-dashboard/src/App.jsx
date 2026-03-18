import { useState, useEffect, useCallback } from "react";

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_DATA = {
  rooms: [
    {
      id: "room-a", name: "Study Room A", floor: "Level 3",
      layout: { rows: 2, cols: 4 },
      seats: [
        { id: "A1", row: 0, col: 0, occupied: true,  reserved: false },
        { id: "A2", row: 0, col: 1, occupied: false, reserved: true  },
        { id: "A3", row: 0, col: 2, occupied: false, reserved: false },
        { id: "A4", row: 0, col: 3, occupied: true,  reserved: false },
        { id: "A5", row: 1, col: 0, occupied: false, reserved: false },
        { id: "A6", row: 1, col: 1, occupied: true,  reserved: false },
        { id: "A7", row: 1, col: 2, occupied: false, reserved: false },
        { id: "A8", row: 1, col: 3, occupied: false, reserved: true  },
      ],
      noise: { db: 42, label: "Quiet",    trend: "stable"  },
      lastUpdated: Date.now() - 8000,
    },
    {
      id: "room-b", name: "Study Room B", floor: "Level 3",
      layout: { rows: 2, cols: 6 },
      seats: [
        { id: "B1",  row: 0, col: 0, occupied: true,  reserved: false },
        { id: "B2",  row: 0, col: 1, occupied: true,  reserved: false },
        { id: "B3",  row: 0, col: 2, occupied: false, reserved: false },
        { id: "B4",  row: 0, col: 3, occupied: false, reserved: true  },
        { id: "B5",  row: 0, col: 4, occupied: true,  reserved: false },
        { id: "B6",  row: 0, col: 5, occupied: false, reserved: false },
        { id: "B7",  row: 1, col: 0, occupied: false, reserved: false },
        { id: "B8",  row: 1, col: 1, occupied: true,  reserved: false },
        { id: "B9",  row: 1, col: 2, occupied: false, reserved: true  },
        { id: "B10", row: 1, col: 3, occupied: true,  reserved: false },
        { id: "B11", row: 1, col: 4, occupied: false, reserved: false },
        { id: "B12", row: 1, col: 5, occupied: false, reserved: false },
      ],
      noise: { db: 67, label: "Moderate", trend: "rising"  },
      lastUpdated: Date.now() - 4000,
    },
    {
      id: "room-c", name: "Discussion Room A", floor: "Level 4",
      layout: { rows: 1, cols: 6 },
      seats: [
        { id: "C1", row: 0, col: 0, occupied: true,  reserved: false },
        { id: "C2", row: 0, col: 1, occupied: true,  reserved: false },
        { id: "C3", row: 0, col: 2, occupied: true,  reserved: false },
        { id: "C4", row: 0, col: 3, occupied: false, reserved: false },
        { id: "C5", row: 0, col: 4, occupied: false, reserved: true  },
        { id: "C6", row: 0, col: 5, occupied: true,  reserved: false },
      ],
      noise: { db: 81, label: "Loud",     trend: "falling" },
      lastUpdated: Date.now() - 12000,
    },
    {
      id: "room-d", name: "Discussion Room B", floor: "Level 5",
      layout: { rows: 3, cols: 4 },
      seats: [
        { id: "D1",  row: 0, col: 0, occupied: false, reserved: false },
        { id: "D2",  row: 0, col: 1, occupied: false, reserved: false },
        { id: "D3",  row: 0, col: 2, occupied: true,  reserved: false },
        { id: "D4",  row: 0, col: 3, occupied: false, reserved: false },
        { id: "D5",  row: 1, col: 0, occupied: false, reserved: true  },
        { id: "D6",  row: 1, col: 1, occupied: false, reserved: false },
        { id: "D7",  row: 1, col: 2, occupied: false, reserved: false },
        { id: "D8",  row: 1, col: 3, occupied: true,  reserved: false },
        { id: "D9",  row: 2, col: 0, occupied: false, reserved: false },
        { id: "D10", row: 2, col: 1, occupied: false, reserved: false },
        { id: "D11", row: 2, col: 2, occupied: false, reserved: false },
        { id: "D12", row: 2, col: 3, occupied: false, reserved: false },
      ],
      noise: { db: 28, label: "Quiet",    trend: "stable"  },
      lastUpdated: Date.now() - 2000,
    },
    {
      id: "room-e", name: "Discussion Room C", floor: "Level 5",
      layout: { rows: 2, cols: 5 },
      seats: [
        // Left side desk cluster
        { id: "A1", row: 0, col: 0, occupied: true,  reserved: false },
        { id: "A2", row: 0, col: 1, occupied: false, reserved: true  },
        
        // Right side desk cluster
        { id: "A3", row: 0, col: 3, occupied: true,  reserved: false },
        { id: "A4", row: 0, col: 4, occupied: false, reserved: false },

        { id: "B1", row: 1, col: 0, occupied: false, reserved: false },
        { id: "B2", row: 1, col: 1, occupied: true,  reserved: false },
        { id: "B3", row: 1, col: 3, occupied: false, reserved: false },
        { id: "B4", row: 1, col: 4, occupied: false, reserved: false },
      ],
      noise: { db: 45, label: "Quiet", trend: "stable" },
      lastUpdated: Date.now() - 2000,
    },
  ],
  lastSync: Date.now(),
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function roomSummary(room) {
  const total    = room.seats.length;
  const occupied = room.seats.filter(s => s.occupied).length;
  const reserved = room.seats.filter(s => !s.occupied && s.reserved).length;
  const vacant   = total - occupied - reserved;
  return { total, occupied, reserved, vacant };
}

function noiseLevel(db) {
  if (db < 50) return { label: "Quiet",    color: "#2f855a" }; // Softer forest green
  if (db < 70) return { label: "Moderate", color: "#c05621" }; // Softer burnt orange
  return              { label: "Loud",     color: "#c53030" }; // Softer crimson red
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
    rooms: data.rooms.map(room => ({
      ...room,
      noise: {
        ...room.noise,
        db: Math.max(20, Math.min(100, room.noise.db + (Math.random() * 4 - 2))),
      },
      lastUpdated: Math.random() > 0.7 ? Date.now() - Math.random() * 3000 : room.lastUpdated,
      seats: room.seats.map(seat => ({
        ...seat,
        occupied: Math.random() > 0.94 ? !seat.occupied : seat.occupied,
      })),
    })),
  };
}

// ─── SEAT MAP ─────────────────────────────────────────────────────────────────
function SeatMap({ room }) {
  const { layout, seats } = room;
  const seatSize = 44;
  const gap = 10;

  // Build a 2D lookup
  const grid = {};
  seats.forEach(s => { grid[`${s.row}-${s.col}`] = s; });

  return (
    <div style={{ width: "100%" }}>
      <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
        Seat Map — {room.name}
      </p>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { color: "#f8fafc", border: "#cbd5e1", label: "Vacant"   },
          { color: "#e6ffed", border: "#2f855a", label: "Occupied" },
          { color: "#fffaf0", border: "#c05621", label: "Reserved" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: l.color, border: `1.5px solid ${l.border}` }} />
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: gap,
        background: "#f1f5f9", // Softer inner background for the map
        borderRadius: 12,
        padding: 20,
        border: "1px solid #e2e8f0",
        width: "100%",
        overflowX: "auto"
      }}>
        {/* Door / front label */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 4,
        }}>
          <div style={{
            fontSize: 11, color: "#94a3b8", letterSpacing: "0.12em",
            textTransform: "uppercase", fontWeight: 600,
            borderBottom: "2px dashed #cbd5e1",
            paddingBottom: 8, width: "100%", textAlign: "center",
          }}>
            Front / Entrance
          </div>
        </div>

        {Array.from({ length: layout.rows }).map((_, rowIdx) => (
          <div key={rowIdx} style={{
            display: "grid",
            gridTemplateColumns: `repeat(${layout.cols}, ${seatSize}px)`,
            gap: gap,
            justifyContent: "center",
          }}>
            {Array.from({ length: layout.cols }).map((_, colIdx) => {
              const seat = grid[`${rowIdx}-${colIdx}`];
              
              if (!seat) {
                return <div key={colIdx} style={{ width: seatSize, height: seatSize }} />;
              }

              const status = seat.occupied ? "occupied" : seat.reserved ? "reserved" : "vacant";
              const styles = {
                // Softened the internal borders and dots
                occupied: { bg: "#e6ffed", border: "#2f855a", dot: "#2f855a", label: "Occ" },
                reserved: { bg: "#fffaf0", border: "#c05621", dot: "#c05621", label: "Res" },
                vacant:   { bg: "#f8fafc", border: "#cbd5e1", dot: "#64748b", label: seat.id  },
              }[status];

              return (
                <div
                  key={seat.id}
                  title={`${seat.id} — ${status.charAt(0).toUpperCase() + status.slice(1)}`}
                  className="seat-cell"
                  style={{
                    width: seatSize,
                    height: seatSize,
                    borderRadius: 8,
                    background: styles.bg,
                    border: `1.5px solid ${styles.border}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    cursor: "default",
                    transition: "transform 0.15s ease",
                    position: "relative",
                  }}
                >
                  <div style={{
                    width: 18, height: 14, borderRadius: "3px 3px 0 0",
                    background: styles.border + "33",
                    border: `1px solid ${styles.border}55`,
                    position: "relative",
                  }}>
                    <div style={{
                      position: "absolute", bottom: -5, left: "50%",
                      transform: "translateX(-50%)",
                      width: 14, height: 5, borderRadius: "0 0 2px 2px",
                      background: styles.border + "22",
                      border: `1px solid ${styles.border}44`,
                      borderTop: "none",
                    }} />
                  </div>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: styles.dot,
                    letterSpacing: "0.05em",
                    fontFamily: "'DM Mono', monospace",
                    lineHeight: 1,
                  }}>
                    {seat.id}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
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
          height: "100%",
          width: `${pct}%`,
          background: nl.color,
          borderRadius: 4,
          transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
          opacity: 0.8,
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
  const [fetchStatus,  setFetchStatus]  = useState("mock"); 
  const [,             setTick]         = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    setData(prev => simulateLiveUpdate(prev));
    setFetchStatus("mock");
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [isLive, fetchData]);

  const room = data.rooms.find(r => r.id === selectedRoom) ?? data.rooms[0];

  const totals = data.rooms.reduce(
    (acc, r) => {
      const s = roomSummary(r);
      return { vacant: acc.vacant + s.vacant, reserved: acc.reserved + s.reserved, occupied: acc.occupied + s.occupied, total: acc.total + s.total };
    },
    { vacant: 0, reserved: 0, occupied: 0, total: 0 }
  );

  const bestRoom = [...data.rooms].sort((a, b) => {
    const score = r => roomSummary(r).vacant * 10 - r.noise.db;
    return score(b) - score(a);
  })[0];
  const bestSummary = roomSummary(bestRoom);
  const bestNoise   = noiseLevel(bestRoom.noise.db);

  const roomSumm = roomSummary(room);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Inter:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        /* Softer global background */
        html, body, #root { width: 100%; min-height: 100vh; background: #eef2f6; color: #334155; font-family: 'Inter', sans-serif; }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
        .room-tab:hover { background: #f1f5f9 !important; }
        .seat-cell:hover { transform: scale(1.08); z-index: 10; }
      `}</style>

      <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── TOP BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 32px", borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: "#334155", letterSpacing: "-0.01em" }}>
              SIT Smart Study Space Monitor
            </h1>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 1, fontFamily: "'DM Mono', monospace" }}>
              INF2009 · G19 · Edge Computing and Analytics
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
                Updated {timeAgo(data.lastSync)}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: fetchStatus === "error" ? "#c53030" : fetchStatus === "live" ? "#2f855a" : "#4a5568",
                animation: isLive ? "blink 2s infinite" : "none",
              }} />
              <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
                {fetchStatus === "mock" ? "SIMULATED" : fetchStatus.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => setIsLive(l => !l)}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                borderRadius: 6, padding: "5px 12px",
                color: "#475569", fontSize: 12, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "background 0.2s, border-color 0.2s",
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#e2e8f0"}
              onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
            >
              {isLive ? "Pause" : "Resume"}
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── ROW 1: SUMMARY STATS ── */}
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
                <p style={{ fontSize: 32, fontWeight: 700, color: stat.color, fontFamily: "'DM: Mono', monospace", lineHeight: 1 }}>{stat.value}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, fontFamily: "'DM: Mono', monospace" }}>{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* ── ROW 2: RECOMMENDATION ── */}
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
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#334155" }}>{bestRoom.name}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{bestRoom.floor}</span>
              </div>
              <p style={{ fontSize: 12, color: "#475569", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                {bestSummary.vacant} vacant · noise <span style={{ color: bestNoise.color }}>{bestNoise.label.toLowerCase()}</span> at {bestRoom.noise.db.toFixed(0)} dB
              </p>
            </div>
            <button
              onClick={() => setSelectedRoom(bestRoom.id)}
              style={{
                background: "#f8fafc", border: "1px solid #cbd5e1",
                borderRadius: 6, padding: "8px 18px",
                color: "#334155", fontSize: 12, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#e2e8f0"}
              onMouseOut={(e) => e.currentTarget.style.background = "#f8fafc"}
            >
              View room
            </button>
          </div>

          {/* ── ROW 3: ROOM TABS ── */}
          <div>
            <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              Rooms
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {data.rooms.map(r => {
                const s  = roomSummary(r);
                const nl = noiseLevel(r.noise.db);
                const isSelected = r.id === selectedRoom;
                const pct = Math.round((s.occupied / s.total) * 100);

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
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: isSelected ? "#334155" : "#475569", margin: 0 }}>{r.name}</p>
                        <p style={{ fontSize: 11, color: "#64748b", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{r.floor}</p>
                      </div>
                      <span style={{ fontSize: 11, color: nl.color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                        {nl.label}
                      </span>
                    </div>

                    {/* Mini occupancy bar */}
                    <div style={{ background: "#e2e8f0", borderRadius: 2, height: 4, marginBottom: 8 }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, borderRadius: 2,
                        background: pct > 80 ? "#c53030" : pct > 50 ? "#c05621" : "#2f855a",
                        transition: "width 0.6s ease",
                      }} />
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "#2f855a", fontFamily: "'DM Mono', monospace" }}>{s.vacant} free</span>
                      <span style={{ fontSize: 11, color: "#c05621", fontFamily: "'DM Mono', monospace" }}>{s.reserved} reserved</span>
                      <span style={{ fontSize: 11, color: "#c53030", fontFamily: "'DM Mono', monospace" }}>{s.occupied} occupied</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── ROW 4: ROOM DETAIL ── */}
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
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#334155", letterSpacing: "-0.01em" }}>{room.name}</h2>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                  {room.floor} · last updated {timeAgo(room.lastUpdated)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { value: roomSumm.vacant,   label: "Vacant",   color: "#2f855a" },
                  { value: roomSumm.reserved, label: "Reserved", color: "#c05621" },
                  { value: roomSumm.occupied, label: "Occupied", color: "#c53030" },
                  { value: roomSumm.total,    label: "Total",    color: "#334155" },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 24, fontWeight: 700, color: item.color, margin: 0, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{item.value}</p>
                    <p style={{ fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Seat map + noise — side by side on wide screens */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px",
              gap: 32,
              alignItems: "start",
            }}>
              <SeatMap room={room} />
              <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 28 }}>
                <NoiseMeter noise={room.noise} />

                {/* Quick stats */}
                <div style={{ marginTop: 28 }}>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                    Occupancy
                  </p>
                  <div style={{ background: "#e2e8f0", borderRadius: 4, height: 6, marginBottom: 8 }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.round((roomSumm.occupied / roomSumm.total) * 100)}%`,
                      background: "#2f855a",
                      borderRadius: 4,
                      transition: "width 0.8s ease",
                      opacity: 0.8,
                    }} />
                  </div>
                  <p style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
                    {roomSumm.occupied} / {roomSumm.total} seats in use
                    ({Math.round((roomSumm.occupied / roomSumm.total) * 100)}%)
                  </p>
                </div>

                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    Suitability
                  </p>
                  {(() => {
                    const nl = noiseLevel(room.noise.db);
                    const freeRatio = roomSumm.vacant / roomSumm.total;
                    let verdict = "Not recommended";
                    let color   = "#c53030";
                    if (freeRatio > 0.4 && room.noise.db < 50) { verdict = "Good for solo study"; color = "#2f855a"; }
                    else if (freeRatio > 0.2 && room.noise.db < 70) { verdict = "Acceptable";         color = "#c05621"; }
                    return (
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color }}>{verdict}</p>
                        <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                          {roomSumm.vacant} free · {nl.label.toLowerCase()} noise
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
            INF2009 G19 · Singapore Institute of Technology · Edge Computing & Analytics
          </p>
        </div>

      </div>

      {/* ── RESPONSIVE ── */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="gridTemplateColumns: 1fr 220px"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="gridTemplateColumns: repeat(4, 1fr)"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="borderLeft: 1px solid #e2e8f0"] {
            border-left: none !important;
            border-top: 1px solid #e2e8f0 !important;
            padding-left: 0 !important;
            padding-top: 24px !important;
          }
        }
        @media (max-width: 600px) {
          div[style*="gridTemplateColumns: repeat(4, 1fr)"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="padding: 28px 32px"] {
            padding: 20px 16px !important;
          }
          div[style*="padding: 16px 32px"] {
            padding: 12px 16px !important;
          }
          div[style*="padding: 24px 28px"] {
            padding: 16px !important;
          }
        }
      `}</style>
    </>
  );
}