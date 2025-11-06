// ===== NOX app.js (no reload on trade + leaderboard/digest) =====

// Your Worker endpoints
const ENDPOINTS = {
  BOARD: "https://nox-proxy.ali-t-chodri.workers.dev/board",
  TRADE: "https://nox-proxy.ali-t-chodri.workers.dev/trade",
  LEADERBOARD: "https://nox-proxy.ali-t-chodri.workers.dev/leaderboard"
};

// Optional demo links (e2 -> deep link to pilot form)
const DEMOS = {
  e2: "https://alichodri.github.io/nox-exercise-e2/#pilot"
};

// Fallback data so cards render if API hiccups
const SAMPLE_BOARD = {
  narratives: [
    { id: "e1", title: "On-device HR copilots", thesis: "Private HR assistants on laptops/phones (compliance, low latency).", price: 58, volume_24h: 90, last_move: +2, exercise: 52 },
    { id: "e2", title: "Edge RAG for Field Service", thesis: "Local doc Q&A for field techs (offline manuals + photos).", price: 63, volume_24h: 140, last_move: +5, exercise: 70 },
    { id: "e3", title: "Retail Loss Prevention Vision", thesis: "Tiny models on cameras for shrink detection, no cloud feed.", price: 61, volume_24h: 120, last_move: +4, exercise: 66 }
  ]
};

// ---------- Helpers ----------
function normKey(k){return String(k||"").replace(/\u00A0/g," ").toLowerCase().trim().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");}
function getByAliases(obj, aliases){
  for (const a of aliases){ if (a in obj) return obj[a]; }
  const map={}; for(const k of Object.keys(obj)) map[normKey(k)]=obj[k];
  for (const a of aliases){ const n=normKey(a); if (n in map) return map[n]; }
  return undefined;
}
function normalizeNarrativeItem(raw){
  const item = typeof raw==="object" ? raw : {};
  const id        = getByAliases(item, ["id"]);
  const title     = getByAliases(item, ["title","name"]);
  const thesis    = getByAliases(item, ["thesis","summary","desc","description"]);
  const price     = Number(getByAliases(item, ["price"]));
  const volume24h = Number(getByAliases(item, ["volume_24h","volume24h","volume"]));
  const lastMove  = Number(getByAliases(item, ["last_move","lastmove","delta","change"]));
  const exercise  = Number(getByAliases(item, ["exercise","conviction","exercise_track"]));
  return {
    id: id ?? "", title: title ?? "", thesis: thesis ?? "",
    price: Number.isFinite(price)?price:0,
    volume_24h: Number.isFinite(volume24h)?volume24h:0,
    last_move: Number.isFinite(lastMove)?lastMove:0,
    exercise: Number.isFinite(exercise)?exercise:0
  };
}

async function fetchBoard(){
  try{
    const r = await fetch(ENDPOINTS.BOARD,{cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const j = await r.json();
    let arr=[]; if(Array.isArray(j)) arr=j; else if(Array.isArray(j.narratives)) arr=j.narratives; else if(Array.isArray(j.data)) arr=j.data;
    const normalized = arr.map(normalizeNarrativeItem).filter(x=>x.title);
    return normalized.length ? {narratives: normalized} : SAMPLE_BOARD;
  }catch(e){ console.warn("Fetch failed, using SAMPLE_BOARD:", e); return SAMPLE_BOARD; }
}

function renderSparkline(canvas, points){
  const ctx=canvas.getContext("2d");
  const w=canvas.width=canvas.clientWidth;
  const h=canvas.height=canvas.clientHeight;
  const max=Math.max(...points), min=Math.min(...points);
  const norm=v=>(h-6)-((v-min)/(max-min||1))*(h-12);
  ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,norm(points[0]));
  const step=w/(points.length-1);
  for(let i=1;i<points.length;i++) ctx.lineTo(i*step, norm(points[i]));
  ctx.strokeStyle="#9fb7ff"; ctx.stroke();
}

// nice toast
function toast(t){
  let n=document.createElement('div');
  n.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111317;border:1px solid #2a2d34;color:#fff;padding:10px 14px;border-radius:10px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.35)";
  n.textContent=t; document.body.appendChild(n);
  setTimeout(()=>{ n.style.opacity='0'; n.style.transition='opacity .4s'; setTimeout(()=>n.remove(),400); },1400);
}

// ---------- Main board render (no reload on trade) ----------
function renderBoard(data){
  const grid=document.getElementById("board");
  if(!grid) return console.error("#board not found");
  grid.innerHTML="";

  data.narratives.forEach(n=>{
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <div class="title">${n.title}</div>
      <div class="thesis">${n.thesis}</div>
      <div class="row">
        <div>
          <div class="price">${n.price}</div>
          <div class="leader">24h ${n.last_move>0?"+":""}${n.last_move} • Vol ${n.volume_24h}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" data-side="long" data-id="${n.id}">Long</button>
          <button type="button" data-side="short" data-id="${n.id}">Short</button>
          ${ DEMOS[n.id]
            ? `
              <a href="${DEMOS[n.id].replace('#pilot','')}" target="_blank" rel="noopener" style="text-decoration:none"><button type="button">Demo</button></a>
              <a href="${DEMOS[n.id]}" target="_blank" rel="noopener" style="text-decoration:none"><button type="button">Request pilot</button></a>
            `
            : `` }
        </div>
      </div>
      <div class="notice">Exercise Track: ${n.exercise || 0}%</div>
      <canvas class="spark"></canvas>
    `;
    grid.appendChild(card);
    const spark=card.querySelector(".spark");
    const pts=Array.from({length:24},()=> n.price + Math.round((Math.random()-0.5)*8));
    renderSparkline(spark, pts);
  });

  // Click handlers for trades (no full-page reload)
  grid.querySelectorAll("button[data-side]").forEach(btn=>{
    btn.addEventListener("click", async (ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      const side=btn.dataset.side, id=btn.dataset.id;
      let handle=localStorage.getItem("nox_handle");
      if(!handle){
        handle=prompt("Pick a handle (letters/numbers)"); if(!handle) return;
        localStorage.setItem("nox_handle", handle);
      }

      // DOM bits to update
      const card=btn.closest(".card");
      const priceEl=card.querySelector(".price");
      const leaderEl=card.querySelector(".leader");
      const curPrice=parseInt(priceEl?.textContent??"0",10)||0;
      const volMatch=(leaderEl?.textContent||"").match(/Vol\s+(\d+)/i);
      const curVol=volMatch?parseInt(volMatch[1],10):0;

      // optimistic UI (same math as backend: points=10 → ±5)
      const delta = side==="long" ? 5 : -5;
      const newPrice=Math.max(0, Math.min(100, curPrice + delta));
      const newVol=curVol + 10;

      // disable during request
      const siblings=card.querySelectorAll("button[data-side]");
      siblings.forEach(b=>b.disabled=true);

      try{
        const payload={ user: handle, narrative_id: id, side, points: 10 };
        const r=await fetch(ENDPOINTS.TRADE,{
          method:"POST",
          headers:{ "Content-Type":"text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
        const msg=await r.text();
        if (priceEl) priceEl.textContent=String(newPrice);
        if (leaderEl) leaderEl.textContent=`24h ${delta>0?"+":""}${delta} • Vol ${newVol}`;
        if (typeof toast==="function") toast(msg); else alert(msg);
      }catch(e){
        console.error(e);
        if (typeof toast==="function") toast("Trade failed"); else alert("Trade failed");
      }finally{
        siblings.forEach(b=>b.disabled=false);
      }
    });
  });
}

// ---------- Leaderboard + Digest ----------
const SAMPLE_LEADERBOARD = [
  { user: "alpha", score: 120 },
  { user: "beta", score: 95 },
  { user: "gamma", score: 80 }
];

async function fetchAndRenderLeaderboard(){
  const el=document.getElementById("leaderboard"); if(!el) return;
  try{
    const r=await fetch(ENDPOINTS.LEADERBOARD,{cache:"no-store"});
    let data=[];
    if(r.ok){ const j=await r.json(); data = Array.isArray(j) ? j : (Array.isArray(j.leaderboard)?j.leaderboard:[]); }
    if(!data.length) data=SAMPLE_LEADERBOARD;
    el.innerHTML="";
    data.slice(0,10).forEach((row,i)=>{
      const name=row.user||row.name||`user${i+1}`;
      const score=row.score ?? row.points ?? row.p ?? 0;
      const div=document.createElement("div");
      div.className="lb__row";
      div.innerHTML=`<div class="lb__name">#${i+1} ${name}</div><div class="lb__score">${score}</div>`;
      el.appendChild(div);
    });
  }catch{
    el.innerHTML=SAMPLE_LEADERBOARD.map((r,i)=>`<div class="lb__row"><div class="lb__name">#${i+1} ${r.user}</div><div class="lb__score">${r.score}</div></div>`).join("");
  }
}

async function fetchAndRenderDigest(){
  const box=document.getElementById("digest"); if(!box) return;
  try{
    const r=await fetch(ENDPOINTS.BOARD.replace("/board","/digest"),{cache:"no-store"});
    if(!r.ok) throw new Error("digest HTTP "+r.status);
    const j=await r.json();
    if (j && j.html) box.innerHTML=j.html;
    else if (j && j.md) box.innerHTML=j.md.split("\n").map(l=>`<p>${l}</p>`).join("");
    else box.innerHTML="<p>No digest available yet.</p>";
  }catch{
    box.innerHTML="<p>No digest available yet.</p>";
  }
}

// ---------- Init ----------
window.addEventListener("DOMContentLoaded", async ()=>{
  const loginBtn=document.getElementById("loginBtn");
  if (loginBtn){
    loginBtn.addEventListener("click",()=>{
      const h=prompt("Pick a handle (letters/numbers).");
      if(h){ localStorage.setItem("nox_handle", h); toast(`Welcome ${h}! +100 points`); }
    });
  }

  const board=await fetchBoard();
  renderBoard(board);

  fetchAndRenderLeaderboard();
  fetchAndRenderDigest();
  const refresh=document.getElementById("digestRefresh");
  if (refresh) refresh.addEventListener("click",(e)=>{ e.preventDefault(); fetchAndRenderDigest(); });
});
