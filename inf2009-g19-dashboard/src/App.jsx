import { useState, useEffect, useCallback } from "react";

const API_URL = "https://yckgmb8guj.execute-api.us-east-1.amazonaws.com/status";
const MIN_SLOTS = 5;

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

// e.g. "study_area_A" → "Study Area A"
function formatAreaName(id) {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Build a live room object from one API item
function roomFromApi(area) {
  const noiseDb = parseFloat(area.noise_level) || 0;
  return {
    id:          area.studyarea_id,
    name:        formatAreaName(area.studyarea_id),
    occupied:    area.occupied_seats  ?? 0,
    reserved:    area.reserved_seats  ?? 0,
    vacant:      area.empty_seats     ?? 0,
    total:       (area.occupied_seats ?? 0) + (area.reserved_seats ?? 0) + (area.empty_seats ?? 0),
    noise: {
      db:    noiseDb,
      label: noiseDb < 50 ? "Quiet" : noiseDb < 70 ? "Moderate" : "Loud",
      trend: "stable",
    },
    lastUpdated: (area.timestamp ? area.timestamp * 1000 : Date.now()),
    isLive:      true,
    hasData:     true,
  };
}

// Empty placeholder slot
function emptySlot(index) {
  return {
    id:      `slot-${index}`,
    name:    "—",
    occupied: 0, reserved: 0, vacant: 0, total: 0,
    noise:   { db: 0, label: "—", trend: "stable" },
    lastUpdated: 0,
    isLive:  false,
    hasData: false,
  };
}

// Build a padded array — at least MIN_SLOTS, grows dynamically beyond that
function buildRoomSlots(apiItems) {
  const live = apiItems.map(roomFromApi);
  const slots = [...live];
  while (slots.length < MIN_SLOTS) slots.push(emptySlot(slots.length));
  return slots;
}

function NoiseMeter({ noise, compact = false }) {
  const nl = noiseLevel(noise.db);
  const pct = Math.min(100, Math.max(0, ((noise.db - 20) / 80) * 100));
  const trendChar = noise.trend === "rising" ? "↑" : noise.trend === "falling" ? "↓" : "—";

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: nl.color, fontFamily: "monospace", lineHeight: 1 }}>
          {noise.db.toFixed(0)}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>dB</span>
        <span style={{ fontSize: 11, color: nl.color }}>{trendChar}</span>
        <span style={{ fontSize: 11, color: nl.color, fontWeight: 600 }}>{nl.label}</span>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        Ambient Noise
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: nl.color, fontFamily: "monospace", lineHeight: 1 }}>
          {noise.db.toFixed(0)}
        </span>
        <span style={{ fontSize: 13, color: "#64748b" }}>dB</span>
        <span style={{ fontSize: 13, color: nl.color, marginLeft: 2 }}>{trendChar}</span>
        <span style={{ fontSize: 12, color: nl.color, marginLeft: 4, fontWeight: 600 }}>{nl.label}</span>
      </div>
      <div style={{ background: "#e2e8f0", borderRadius: 4, height: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: nl.color, borderRadius: 4, transition: "width 1s ease", opacity: 0.8 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>20 dB</span>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>100 dB</span>
      </div>
    </div>
  );
}

function RoomCard({ room, isSelected, onClick }) {
  // Empty slot — non-interactive placeholder
  if (!room.hasData) {
    return (
      <div style={{
        background: "#f8fafc",
        border: "1.5px dashed #e2e8f0",
        borderRadius: 12, padding: "14px 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 88,
      }}>
        <p style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "monospace", letterSpacing: "0.06em" }}>
          NO READING
        </p>
      </div>
    );
  }

  const nl = noiseLevel(room.noise.db);
  const pct = room.total > 0 ? Math.round((room.occupied / room.total) * 100) : 0;
  const availColor = room.vacant > 0 ? "#2f855a" : "#c53030";

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? "#f0fdf4" : "#f8fafc",
        border: `1.5px solid ${isSelected ? "#2f855a" : "#e2e8f0"}`,
        borderRadius: 12, padding: "14px 16px",
        cursor: "pointer", transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      {/* LIVE badge */}
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#2f855a", animation: "blink 2s infinite" }} />
        <span style={{ fontSize: 8, color: "#2f855a", fontFamily: "monospace", fontWeight: 700 }}>LIVE</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#334155", margin: 0 }}>{room.name}</p>
          <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, fontFamily: "monospace" }}>
            {timeAgo(room.lastUpdated)}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: availColor, margin: 0, fontFamily: "monospace", lineHeight: 1 }}>{room.vacant}</p>
          <p style={{ fontSize: 9, color: "#94a3b8", marginTop: 1, textTransform: "uppercase", letterSpacing: "0.06em" }}>free</p>
        </div>
      </div>

      {/* Occupancy bar */}
      <div style={{ background: "#e2e8f0", borderRadius: 2, height: 3, marginBottom: 6 }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 2,
          background: pct > 80 ? "#c53030" : pct > 50 ? "#c05621" : "#2f855a",
          transition: "width 0.6s ease",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#2f855a", fontFamily: "monospace" }}>{room.vacant} free</span>
          <span style={{ fontSize: 10, color: "#c05621", fontFamily: "monospace" }}>{room.reserved} res</span>
          <span style={{ fontSize: 10, color: "#c53030", fontFamily: "monospace" }}>{room.occupied} occ</span>
        </div>
        <span style={{ fontSize: 10, color: nl.color, fontFamily: "monospace", fontWeight: 600 }}>{nl.label}</span>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────
export default function App() {
  const [rooms,        setRooms]        = useState(Array.from({ length: MIN_SLOTS }, (_, i) => emptySlot(i)));
  const [lastSync,     setLastSync]     = useState(Date.now());
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isLive,       setIsLive]       = useState(true);
  const [fetchStatus,  setFetchStatus]  = useState("connecting");
  const [,             setTick]         = useState(0);

  // Re-render clock every second (for timeAgo)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("API error");
      const apiData = await res.json();

      const slots = buildRoomSlots(Array.isArray(apiData) ? apiData : []);
      setRooms(slots);
      setLastSync(Date.now());
      setFetchStatus("live");

      // Auto-select first live room if nothing selected yet
      setSelectedRoom(prev => {
        if (prev) return prev;
        const first = slots.find(r => r.hasData);
        return first ? first.id : null;
      });
    } catch (err) {
      setFetchStatus("error");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [isLive, fetchData]);

  // Only count rooms that have real data for totals / best spot
  const liveRooms = rooms.filter(r => r.hasData);

  const totals = liveRooms.reduce(
    (acc, r) => ({
      vacant:   acc.vacant   + r.vacant,
      reserved: acc.reserved + r.reserved,
      occupied: acc.occupied + r.occupied,
      total:    acc.total    + r.total,
    }),
    { vacant: 0, reserved: 0, occupied: 0, total: 0 }
  );

  const bestRoom = liveRooms.length > 0
    ? [...liveRooms].sort((a, b) => (b.vacant * 10 - b.noise.db) - (a.vacant * 10 - a.noise.db))[0]
    : null;
  const bestNoise = bestRoom ? noiseLevel(bestRoom.noise.db) : null;

  // Selected room detail (fall back to first live room)
  const room = rooms.find(r => r.id === selectedRoom && r.hasData)
    ?? liveRooms[0]
    ?? null;
  const roomNl = room ? noiseLevel(room.noise.db) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; background: #eef2f6; color: #334155; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }

        /* ── DESKTOP ── */
        .layout { display: flex; flex-direction: column; }
        .topbar { padding: 16px 32px; }
        .main { padding: 24px 32px; gap: 24px; }
        .stats-grid { grid-template-columns: repeat(4, 1fr); }
        .room-grid { grid-template-columns: repeat(5, 1fr); }
        .detail-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
        .tab-label { display: inline; }

        /* ── MOBILE ── */
        @media (max-width: 640px) {
          .topbar { padding: 12px 16px; }
          .main { padding: 16px; gap: 16px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-card { padding: 12px 14px !important; }
          .stat-value { font-size: 24px !important; }
          .room-grid { grid-template-columns: 1fr; gap: 8px; }          .detail-grid { grid-template-columns: 1fr; gap: 24px; }
          .detail-pad { padding: 16px !important; }
          .detail-header { flex-direction: column; gap: 12px; }
          .detail-counts { gap: 12px !important; }
          .detail-count-val { font-size: 20px !important; }
          .best-row { flex-direction: column; align-items: flex-start !important; gap: 10px; }
          .topbar-title { font-size: 14px !important; }
          .topbar-sub { display: none; }
          .pause-btn { display: none; }
          .tab-label { display: none; }
          .footer { padding: 10px 16px !important; font-size: 9px !important; }
        }
      `}</style>

      <div className="layout" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── TOP BAR ── */}
        <div className="topbar" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid #e2e8f0", background: "#f8fafc",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <h1 className="topbar-title" style={{ fontSize: 16, fontWeight: 600, color: "#334155" }}>
              SIT Study Space
            </h1>
            <p className="topbar-sub" style={{ fontSize: 11, color: "#64748b", marginTop: 1, fontFamily: "monospace" }}>
              INF2009 · G19 · Edge Computing
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
              {timeAgo(lastSync)}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: fetchStatus === "error" ? "#c53030" : fetchStatus === "live" ? "#2f855a" : "#94a3b8",
                animation: isLive ? "blink 2s infinite" : "none",
              }} />
              <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                {fetchStatus === "live" ? "LIVE" : fetchStatus === "error" ? "ERR" : "..."}
              </span>
            </div>
            <button
              className="pause-btn"
              onClick={() => setIsLive(l => !l)}
              style={{
                background: "transparent", border: "1px solid #cbd5e1",
                borderRadius: 6, padding: "4px 10px", color: "#475569",
                fontSize: 11, cursor: "pointer",
              }}
            >
              {isLive ? "Pause" : "Resume"}
            </button>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div className="main" style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* ── SUMMARY STATS ── */}
          <div className="stats-grid" style={{ display: "grid", gap: 10 }}>
            {[
              { label: "Total",    value: totals.total,    sub: "seats",     color: "#334155" },
              { label: "Free",     value: totals.vacant,   sub: "available", color: "#2f855a" },
              { label: "Occupied", value: totals.occupied, sub: "in use",    color: "#c53030" },
              { label: "Reserved", value: totals.reserved, sub: "held",      color: "#c05621" },
            ].map(stat => (
              <div className="stat-card" key={stat.label} style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: "16px 18px",
              }}>
                <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{stat.label}</p>
                <p className="stat-value" style={{ fontSize: 30, fontWeight: 700, color: stat.color, fontFamily: "monospace", lineHeight: 1 }}>{stat.value}</p>
                <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontFamily: "monospace" }}>{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* ── BEST SPOT ── */}
          <div style={{
            background: "#f1f5f9", border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 10, marginTop: 0,
          }}>
            {bestRoom ? (
              <div className="best-row" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                    Best spot
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#334155" }}>{bestRoom.name}</p>
                  <p style={{ fontSize: 11, color: "#475569", marginTop: 2, fontFamily: "monospace" }}>
                    {bestRoom.vacant} free · <span style={{ color: bestNoise.color }}>{bestNoise.label.toLowerCase()}</span> · {bestRoom.noise.db.toFixed(0)} dB
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRoom(bestRoom.id)}
                  style={{
                    background: "#334155", border: "none",
                    borderRadius: 8, padding: "8px 16px", color: "#fff",
                    fontSize: 12, cursor: "pointer", fontWeight: 500,
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  View →
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
                Waiting for sensor data…
              </p>
            )}
          </div>

          {/* ── ROOMS LIST / CAROUSEL ── */}
          <div>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  All Rooms
                </p>
                {rooms.length > MIN_SLOTS && (
                  <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
                    {rooms.filter(r => r.hasData).length} active
                  </span>
                )}
              </div>
              {/* Prev/Next buttons — only when overflow */}
              {rooms.length > MIN_SLOTS && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => { const el = document.getElementById("room-carousel"); if (el) el.scrollBy({ left: -220, behavior: "smooth" }); }}
                    style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 13, color: "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >‹</button>
                  <button
                    onClick={() => { const el = document.getElementById("room-carousel"); if (el) el.scrollBy({ left: 220, behavior: "smooth" }); }}
                    style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 13, color: "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >›</button>
                </div>
              )}
            </div>

            {rooms.length <= MIN_SLOTS ? (
              /* GRID (≤5 rooms): cards stretch to fill full width */
              <div className="room-grid" style={{ display: "grid", gap: 10 }}>
                {rooms.map(r => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    isSelected={r.id === selectedRoom}
                    onClick={() => r.hasData && setSelectedRoom(r.id)}
                  />
                ))}
              </div>
            ) : (
              /* CAROUSEL (>5 rooms): fixed-width cards, horizontal scroll */
              <>
                <div
                  id="room-carousel"
                  style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: 8, scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  <style>{`#room-carousel::-webkit-scrollbar { display: none; }`}</style>
                  {rooms.map(r => (
                    <div key={r.id} style={{ flex: "0 0 220px", scrollSnapAlign: "start" }}>
                      <RoomCard
                        room={r}
                        isSelected={r.id === selectedRoom}
                        onClick={() => r.hasData && setSelectedRoom(r.id)}
                      />
                    </div>
                  ))}
                </div>
                {/* Dot indicators */}
                <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 10 }}>
                  {rooms.map(r => (
                    <div
                      key={r.id}
                      onClick={() => {
                        if (!r.hasData) return;
                        const el = document.getElementById("room-carousel");
                        const idx = rooms.indexOf(r);
                        if (el) el.scrollTo({ left: idx * 230, behavior: "smooth" });
                        setSelectedRoom(r.id);
                      }}
                      style={{ width: r.id === selectedRoom ? 16 : 6, height: 6, borderRadius: 99, background: r.id === selectedRoom ? "#2f855a" : r.hasData ? "#cbd5e1" : "#e2e8f0", transition: "all 0.3s ease", cursor: r.hasData ? "pointer" : "default" }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── ROOM DETAIL ── */}
          {room ? (
            <div
              key={room.id}
              className="detail-pad"
              style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: "20px 24px",
                animation: "fadeIn 0.25s ease",
              }}
            >
              {/* Header */}
              <div className="detail-header" style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #e2e8f0",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: "#334155" }}>{room.name}</h2>
                    <span style={{
                      fontSize: 9, color: "#2f855a", fontFamily: "monospace",
                      fontWeight: 700, background: "#f0fff4", border: "1px solid #c6f6d5",
                      borderRadius: 99, padding: "2px 7px",
                    }}>LIVE</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#64748b", marginTop: 2, fontFamily: "monospace" }}>
                    {timeAgo(room.lastUpdated)}
                  </p>
                </div>
                <div className="detail-counts" style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                  {[
                    { value: room.vacant,   label: "Free",  color: "#2f855a" },
                    { value: room.reserved, label: "Res",   color: "#c05621" },
                    { value: room.occupied, label: "Occ",   color: "#c53030" },
                    { value: room.total,    label: "Total", color: "#334155" },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: "center" }}>
                      <p className="detail-count-val" style={{ fontSize: 22, fontWeight: 700, color: item.color, margin: 0, fontFamily: "monospace", lineHeight: 1 }}>{item.value}</p>
                      <p style={{ fontSize: 10, color: "#64748b", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Noise + Occupancy */}
              <div className="detail-grid" style={{ display: "grid" }}>
                <NoiseMeter noise={room.noise} />

                <div>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    Occupancy
                  </p>
                  <div style={{ background: "#e2e8f0", borderRadius: 4, height: 6, marginBottom: 8 }}>
                    <div style={{
                      height: "100%",
                      width: `${room.total > 0 ? Math.round((room.occupied / room.total) * 100) : 0}%`,
                      background: "#2f855a", borderRadius: 4, transition: "width 0.8s ease", opacity: 0.8,
                    }} />
                  </div>
                  <p style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
                    {room.occupied}/{room.total} in use ({room.total > 0 ? Math.round((room.occupied / room.total) * 100) : 0}%)
                  </p>

                  <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                      Suitability
                    </p>
                    {(() => {
                      const freeRatio = room.total > 0 ? room.vacant / room.total : 0;
                      let verdict = "Not recommended"; let color = "#c53030";
                      if (freeRatio > 0.4 && room.noise.db < 50) { verdict = "Good for solo study"; color = "#2f855a"; }
                      else if (freeRatio > 0.2 && room.noise.db < 70) { verdict = "Acceptable"; color = "#c05621"; }
                      return (
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color }}>{verdict}</p>
                          <p style={{ fontSize: 11, color: "#64748b", marginTop: 3, fontFamily: "monospace" }}>
                            {room.vacant} free · {roomNl.label.toLowerCase()} noise
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="detail-pad" style={{
              background: "#f8fafc", border: "1px dashed #e2e8f0",
              borderRadius: 10, padding: "40px 24px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
                Waiting for sensor data…
              </p>
            </div>
          )}

        </div>

        {/* ── FOOTER ── */}
        <div className="footer" style={{ padding: "12px 32px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
            INF2009 G19 · SIT · Powered by Raspberry Pi sensors
          </p>
        </div>

      </div>
    </>
  );
}