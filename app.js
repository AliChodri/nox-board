// ===== NOX app.js (robust key mapping + simple-request trades) =====

// Your Apps Script endpoints (leave as-is if they work for trading)
const ENDPOINTS = {
  BOARD: "https://nox-proxy.ali-t-chodri.workers.dev/board",
  TRADE: "https://nox-proxy.ali-t-chodri.workers.dev/trade",
  LEADERBOARD: "https://nox-proxy.ali-t-chodri.workers.dev/leaderboard"
};


// Optional: demo links
const DEMOS = { e2: "https://alichodri.github.io/nox-exercise-e2/#pilot" };

// Fallback data so cards render even if API is unreachable
const SAMPLE_BOARD = {
  narratives: [
    { id: "e1", title: "On-device HR copilots", thesis: "Private HR assistants on laptops/phones (compliance, low latency).", price: 58, volume_24h: 90, last_move: +2, exercise: 52 },
    { id: "e2", title: "Edge RAG for Field Service", thesis: "Local doc Q&A for field techs (offline manuals + photos).", price: 63, volume_24h: 140, last_move: +5, exercise: 70 },
    { id: "e3", title: "Retail Loss Prevention Vision", thesis: "Tiny models on cameras for shrink detection, no cloud feed.", price: 61, volume_24h: 120, last_move: +4, exercise: 66 }
  ]
};

// --------- Tolerant mappers (fix "undefined" issues) ---------
function normKey(k) {
  return String(k || "")
    .replace(/\u00A0/g, " ")     // NBSP -> space
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")        // spaces -> underscores
    .replace(/[^a-z0-9_]/g, ""); // strip punctuation
}
function getByAliases(obj, aliases) {
  // Try exact aliases first
  for (const a of aliases) {
    if (a in obj) return obj[a];
  }
  // Then try normalized-key match
  const map = {};
  for (const k of Object.keys(obj)) map[normKey(k)] = obj[k];
  for (const a of aliases) {
    const n = normKey(a);
    if (n in map) return map[n];
  }
  return undefined;
}

function normalizeNarrativeItem(raw) {
  // accept either flat item or [header->value] pairs
  const item = typeof raw === "object" ? raw : {};

  const id        = getByAliases(item, ["id"]);
  const title     = getByAliases(item, ["title", "name"]);
  const thesis    = getByAliases(item, ["thesis", "summary", "desc", "description"]);
  const price     = Number(getByAliases(item, ["price"]));
  const volume24h = Number(getByAliases(item, ["volume_24h", "volume24h", "volume"]));
  const lastMove  = Number(getByAliases(item, ["last_move", "lastmove", "delta", "change"]));
  const exercise  = Number(getByAliases(item, ["exercise", "conviction", "exercise_track"]));

  return {
    id: id ?? "",
    title: title ?? "",
    thesis: thesis ?? "",
    price: Number.isFinite(price) ? price : 0,
    volume_24h: Number.isFinite(volume24h) ? volume24h : 0,
    last_move: Number.isFinite(lastMove) ? lastMove : 0,
    exercise: Number.isFinite(exercise) ? exercise : 0
  };
}

async function fetchBoard() {
  try {
    const r = await fetch(ENDPOINTS.BOARD, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();

    // accept several shapes: {narratives:[...]}, [...] or {data:[...]}
    let arr = [];
    if (Array.isArray(j)) arr = j;
    else if (Array.isArray(j.narratives)) arr = j.narratives;
    else if (Array.isArray(j.data)) arr = j.data;

    // normalize every item
    const normalized = arr.map(normalizeNarrativeItem).filter(x => x.title);
    if (!normalized.length) return SAMPLE_BOARD;

    return { narratives: normalized };
  } catch (e) {
    console.warn("Fetch failed, using SAMPLE_BOARD fallback:", e);
    return SAMPLE_BOARD;
  }
}

// --------- UI rendering & trading ---------
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
  if (!grid) return console.error("#board container not found");
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
        <div style="display:flex; gap:8px; align-items:center;">
          <button data-side="long" data-id="${n.id}">Long</button>
          <button data-side="short" data-id="${n.id}">Short</button>
         ${ DEMOS[n.id]
  ? `
     <a href="${DEMOS[n.id].replace('#pilot','')}" target="_blank" rel="noopener" style="text-decoration:none"><button>Demo</button></a>
     <a href="${DEMOS[n.id]}" target="_blank" rel="noopener" style="text-decoration:none"><button>Request pilot</button></a>
    `
  : `` }

        </div>
      </div>
      <div class="notice">Exercise Track: ${n.exercise || 0}%</div>
      <canvas class="spark"></canvas>
    `;
    grid.appendChild(card);

    const spark = card.querySelector(".spark");
    const pts = Array.from({ length: 24 }, () => n.price + Math.round((Math.random() - 0.5) * 8));
    renderSparkline(spark, pts);
  });

// --- Leaderboard + Digest renderers ---
const SAMPLE_LEADERBOARD = [
  { user: "alpha", score: 120 },
  { user: "beta", score: 95 },
  { user: "gamma", score: 80 }
];

async function fetchAndRenderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (!el) return;
  try {
    const r = await fetch(ENDPOINTS.LEADERBOARD, { cache: "no-store" });
    let data = [];
    if (r.ok) {
      const j = await r.json();
      data = Array.isArray(j) ? j : (Array.isArray(j.leaderboard) ? j.leaderboard : []);
    }
    if (!data.length) data = SAMPLE_LEADERBOARD;
    el.innerHTML = "";
    data.slice(0, 10).forEach((row, i) => {
      const name = row.user || row.name || `user${i+1}`;
      const score = row.score ?? row.points ?? row.p ?? 0;
      const div = document.createElement("div");
      div.className = "lb__row";
      div.innerHTML = `<div class="lb__name">#${i+1} ${name}</div><div class="lb__score">${score}</div>`;
      el.appendChild(div);
    });
  } catch {
    el.innerHTML = SAMPLE_LEADERBOARD.map((r,i)=>`<div class="lb__row"><div class="lb__name">#${i+1} ${r.user}</div><div class="lb__score">${r.score}</div></div>`).join("");
  }
}

async function fetchAndRenderDigest() {
  const box = document.getElementById("digest");
  if (!box) return;
  try {
    const r = await fetch(ENDPOINTS.BOARD.replace("/board","/digest"), { cache: "no-store" });
    if (!r.ok) throw new Error("digest HTTP " + r.status);
    const j = await r.json();
    // j may be {html, md}; prefer html if present
    if (j && j.html) {
      box.innerHTML = j.html;
    } else if (j && j.md) {
      // simple md fallback: lines to <p>
      box.innerHTML = j.md.split("\n").map(l => `<p>${l}</p>`).join("");
    } else {
      box.innerHTML = "<p>No digest available yet.</p>";
    }
  } catch {
    box.innerHTML = "<p>No digest available yet.</p>";
  }
}

  
  // Click handlers for trades
  grid.querySelectorAll("button[data-side]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const side = btn.dataset.side, id = btn.dataset.id;
      let handle = localStorage.getItem("nox_handle");
      if (!handle) {
        handle = prompt("Pick a handle (letters/numbers)");
        if (!handle) return;
        localStorage.setItem("nox_handle", handle);
      }
      const payload = { user: handle, narrative_id: id, side, points: 10 };
      try {
        const r = await fetch(ENDPOINTS.TRADE, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request (no preflight)
          body: JSON.stringify(payload)
        });
        const msg = await r.text();
        alert(msg);
        location.reload();
      } catch (e) {
        console.error(e);
        alert("Trade failed. Check console.");
      }
    });
  });
}

// Wait for DOM before wiring UI
// Wait for DOM before wiring UI
window.addEventListener("DOMContentLoaded", async () => {
  // existing: sign-handle button
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const h = prompt("Pick a handle (letters/numbers).");
      if (h) { localStorage.setItem("nox_handle", h); alert(`Welcome ${h}! You have 100 points today.`); }
    });
  } else {
    console.warn("#loginBtn not found");
  }

  // existing: render the board
  const board = await fetchBoard();
  renderBoard(board);

  // NEW: render Leaderboard + Digest and hook the refresh link
  fetchAndRenderLeaderboard();
  fetchAndRenderDigest();
  const refresh = document.getElementById("digestRefresh");
  if (refresh) {
    refresh.addEventListener("click", (e) => {
      e.preventDefault();
      fetchAndRenderDigest();
    });
  }
});
