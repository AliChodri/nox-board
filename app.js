const ENDPOINTS = {
  BOARD: "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhjiroKBdSUtSQUs2DlFGRlU3NE3O0qVIln2S2u8PXZaKB1XPvH4-7U3VvwrlJpfc57V6qEedw1yDCtU-Ypt4exh2SC_-p2XQmqnZsTi5vVTEdY8gQUPFlu4TqXNwbGSrNGKNLfkAFiz8A8ycDWYUh9d3dBPLeYFABtGu4PEv5nnLXkpSF2eexyeuSmyuu1CBcsiOZmaRGRH7VAaqM9xUV_RxPbFfoOUsemP_akc7LcWP35VMkY_naD4YunkA&lib=MjPw__fcNvRduNEIKCVOmADU45U1klR7t",
  TRADE: "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhjiroKBdSUtSQUs2DlFGRlU3NE3O0qVIln2S2u8PXZaKB1XPvH4-7U3VvwrlJpfc57V6qEedw1yDCtU-Ypt4exh2SC_-p2XQmqnZsTi5vVTEdY8gQUPFlu4TqXNwbGSrNGKNLfkAFiz8A8ycDWYUh9d3dBPLeYFABtGu4PEv5nnLXkpSF2eexyeuSmyuu1CBcsiOZmaRGRH7VAaqM9xUV_RxPbFfoOUsemP_akc7LcWP35VMkY_naD4YunkA&lib=MjPw__fcNvRduNEIKCVOmADU45U1klR7t",
  LEADERBOARD: "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhjiroKBdSUtSQUs2DlFGRlU3NE3O0qVIln2S2u8PXZaKB1XPvH4-7U3VvwrlJpfc57V6qEedw1yDCtU-Ypt4exh2SC_-p2XQmqnZsTi5vVTEdY8gQUPFlu4TqXNwbGSrNGKNLfkAFiz8A8ycDWYUh9d3dBPLeYFABtGu4PEv5nnLXkpSF2eexyeuSmyuu1CBcsiOZmaRGRH7VAaqM9xUV_RxPbFfoOUsemP_akc7LcWP35VMkY_naD4YunkA&lib=MjPw__fcNvRduNEIKCVOmADU45U1klR7t"
};

async function fetchBoard() {
  try { const r = await fetch(ENDPOINTS.BOARD); return await r.json(); }
  catch { return { narratives: [] }; }
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

(async function init(){ const board = await fetchBoard(); renderBoard(board); })();
