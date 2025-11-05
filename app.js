// ===== NOX app.js (known-good) =====
// 1) Replace YOUR_WEB_APP_URL_HERE with your Apps Script Web App URL (ends with /exec)
const ENDPOINTS = {
  BOARD: "https://script.google.com/macros/s/AKfycbwY4xV58FIJEQ359m3DSAyCoN1_YYxvRxbeG6kVojGr94XIadfinLs5PLC50qpvPe3_/exec?route=board",
  TRADE: "https://script.google.com/macros/s/AKfycbwY4xV58FIJEQ359m3DSAyCoN1_YYxvRxbeG6kVojGr94XIadfinLs5PLC50qpvPe3_/exec?route=trade",
  LEADERBOARD: "https://script.google.com/macros/s/AKfycbwY4xV58FIJEQ359m3DSAyCoN1_YYxvRxbeG6kVojGr94XIadfinLs5PLC50qpvPe3_/exec?route=leaderboard"
};

// 2) Sample fallback so cards render even if the API URL is wrong
const SAMPLE_BOARD = {
  narratives: [
    { id: "e1", title: "On-device HR copilots", thesis: "Private HR assistants on laptops/phones (compliance, low latency).", price: 58, volume_24h: 90, last_move: +2, exercise: 52 },
    { id: "e2", title: "Edge RAG for Field Service", thesis: "Local doc Q&A for field techs (offline manuals + photos).", price: 63, volume_24h: 140, last_move: +5, exercise: 70 },
    { id: "e3", title: "Retail Loss Prevention Vision", thesis: "Tiny models on cameras for shrink detection, no cloud feed.", price: 61, volume_24h: 120, last_move: +4, exercise: 66 }
  ]
};

async function fetchBoard() {
  try {
    const r = await fetch(ENDPOINTS.BOARD, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!j || !Array.isArray(j.narratives) || j.narratives.length === 0) {
      console.warn("API returned no narratives. Falling back to SAMPLE_BOARD.");
      return SAMPLE_BOARD;
    }
    return j;
  } catch (e) {
    console.warn("Fetch failed, using SAMPLE_BOARD fallback:", e);
    return SAMPLE_BOARD;
  }
}

function renderSparkline(canvas, points) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  const max = Math.max(...points), min = Math.min(...points);
  const norm = v => (h - 6) - ((v - min) / (max - min || 1)) * (h - 12);
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, norm(points[0]));
  const step = w / (points.length - 1);
  for (let i = 1; i < points.length; i++) ctx.lineTo(i * step, norm(points[i]));
  ctx.strokeStyle = "#9fb7ff"; ctx.stroke();
}

function renderBoard(data) {
  const grid = document.getElementById("board");
  grid.innerHTML = "";
  data.narratives.forEach(n => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="title">${n.title}</div>
      <div class="thesis">${n.thesis}</div>
      <div class="row">
        <div>
          <div class="price">${n.price}</div>
          <div class="leader">24h ${n.last_move > 0 ? "+" : ""}${n.last_move} • Vol ${n.volume_24h}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button data-side="long" data-id="${n.id}">Long</button>
          <button data-side="short" data-id="${n.id}">Short</button>
        </div>
      </div>
      <div class="notice">Exercise Track: ${n.exercise || 0}%</div>
      <canvas class="spark"></canvas>
    `;
    grid.appendChild(card);
    const spark = card.querySelector(".spark");
    const pts = Array.from({length: 24}, () => n.price + Math.round((Math.random() - 0.5) * 8));
    renderSparkline(spark, pts);
  });

  grid.querySelectorAll("button[data-side]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const side = btn.dataset.side, id = btn.dataset.id;
      const handle = localStorage.getItem("nox_handle") || prompt("Pick a handle");
      if (!handle) return;
      localStorage.setItem("nox_handle", handle);
      const payload = { user: handle, narrative_id: id, side, points: 10 };
      try {
        const r = await fetch(ENDPOINTS.TRADE, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        alert(await r.text());
        location.reload();
      } catch (e) {
        alert("Trade failed. Check console."); console.error(e);
      }
    });
  });
}

document.getElementById("loginBtn").addEventListener("click", () => {
  const h = prompt("Pick a handle (letters/numbers).");
  if (h) { localStorage.setItem("nox_handle", h); alert(`Welcome ${h}! You have 100 points today.`); }
});

(async function init(){
  const board = await fetchBoard();
  renderBoard(board);
})();
