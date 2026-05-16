<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STUDYPILOT • Student OS</title>
<style>
:root {
  --bg: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  --glass: rgba(255,255,255,0.92);
  --glass-border: rgba(255,255,255,0.98);
  --text: #0f172a;
  --muted: #64748b;
  --accent: #3b82f6;
  --red: #ef4444;
  --radius: 22px;
}
body.dark {
  --bg: linear-gradient(135deg, #1e2937 0%, #0f172a 100%);
  --glass: rgba(15,23,42,0.95);
  --glass-border: rgba(148,163,184,0.35);
  --text: #f1f5f9;
  --muted: #94a3b8;
}

* { box-sizing: border-box; }
body {
  margin:0; font-family:Inter,system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh;
}

.app-shell { display:grid; grid-template-columns:280px 1fr; min-height:100vh; }

.sidebar {
  background:var(--glass); backdrop-filter:blur(32px); border-right:1px solid var(--glass-border);
  display:flex; flex-direction:column;
}

.glass-panel, .audio-glass {
  background:var(--glass); backdrop-filter:blur(32px); border:1px solid var(--glass-border);
  border-radius:var(--radius); padding:28px; box-shadow:0 10px 30px -10px rgba(0,0,0,0.12);
  animation:fadeInUp 0.6s ease forwards;
}

.audio-glass { backdrop-filter:blur(40px); padding:26px; }

.timer-face {
  font-size:6.2rem; font-weight:800; letter-spacing:10px; text-align:center;
  padding:52px 20px; background:rgba(255,255,255,0.45); border:5px solid var(--accent);
  border-radius:28px; animation:pulse 6s infinite ease-in-out;
}

body.dark .timer-face { background:rgba(15,23,42,0.8); }

@keyframes fadeInUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)} 50%{box-shadow:0 0 0 35px rgba(59,130,246,0)} }

.tab-btn {
  width:100%; padding:16px 28px; border:none; background:transparent; color:var(--muted);
  font-weight:600; display:flex; align-items:center; gap:14px; cursor:pointer;
  border-radius:14px; margin:4px 12px; transition:all 0.3s;
}
.tab-btn.active, .tab-btn:hover { background:rgba(59,130,246,0.15); color:var(--accent); transform:translateX(8px); }

.btn-primary {
  background:linear-gradient(135deg,#2563eb,#3b82f6); color:white; border:none;
  padding:13px 28px; border-radius:14px; font-weight:600; cursor:pointer;
  transition:all 0.3s;
}
.btn-primary:hover { transform:translateY(-4px); box-shadow:0 15px 30px rgba(59,130,246,0.4); }
</style>
</head>
<body>
<div id="app"></div>

<script>
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const VAULTS = ["JEE", "NEET", "Boards"];
let currentVault = "JEE";
let activeView = "dashboard";
let currentUser = null;

let state = null;

let timer = { total: 45*60, remaining: 45*60, running: false };
let timerInterval = null;
let audio = { player: null, ctx: null };

const airports = [
  {code:"DEL", city:"Delhi", lat:28.5562, lon:77.1},
  {code:"BOM", city:"Mumbai", lat:19.0896, lon:72.8656},
  {code:"BLR", city:"Bengaluru", lat:13.1986, lon:77.7066},
  {code:"MAA", city:"Chennai", lat:12.9941, lon:80.1709},
  {code:"CCU", city:"Kolkata", lat:22.6547, lon:88.4467},
  {code:"HYD", city:"Hyderabad", lat:17.2403, lon:78.4294},
  {code:"DXB", city:"Dubai", lat:25.2532, lon:55.3657},
  {code:"LHR", city:"London", lat:51.47, lon:-0.4543},
  {code:"JFK", city:"New York", lat:40.6413, lon:-73.7781},
  {code:"SIN", city:"Singapore", lat:1.3644, lon:103.9915}
];

// Load user state from your server
async function loadState() {
  try {
    const res = await fetch("/api/state");
    if (res.ok) {
      state = await res.json();
    } else {
      state = { chapters: [], exams: [], plans: [], formulas: [], settings: { name: currentUser || "Student", darkMode: false } };
    }
  } catch (e) {
    state = { chapters: [], exams: [], plans: [], formulas: [], settings: { name: "Student", darkMode: false } };
  }
  render();
}

function saveState() {
  fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
}

function commit(fn) {
  fn(state);
  saveState();
  render();
}

// ==================== RENDER ====================
function render() {
  const c = state || {};
  $("#app").innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="content" style="padding:40px">
        ${views[activeView](c)}
      </main>
    </div>
  `;
  bindEvents();
  if (activeView === "dashboard") setTimeout(initParticles, 100);
  if (activeView === "timers") setTimeout(initAudioPlayer, 100);
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div style="padding:32px 28px;display:flex;align-items:center;gap:16px">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:white;border-radius:16px;display:grid;place-items:center;font-size:28px;font-weight:900">SP</div>
        <div style="font-size:1.85rem;font-weight:800">STUDYPILOT</div>
      </div>

      <div style="padding:0 28px 20px;display:flex;gap:8px;flex-wrap:wrap">
        ${VAULTS.map(v => `<div onclick="switchVault('${v}')" style="padding:9px 20px;border-radius:9999px;cursor:pointer;background:${currentVault===v?'#3b82f6':'var(--glass)'};color:${currentVault===v?'white':'var(--text)'};font-weight:500">${v}</div>`).join('')}
      </div>

      <nav style="flex:1">
        ${["dashboard","chapters","formulas","planner","exams","timers"].map(v => `
          <button data-view="${v}" class="tab-btn ${activeView===v?'active':''}">
            ${v==='dashboard'?'🏠':v==='chapters'?'📖':v==='formulas'?'📐':v==='planner'?'✅':v==='exams'?'📆':'⏱'} ${v.charAt(0).toUpperCase()+v.slice(1)}
          </button>`).join('')}
      </nav>

      <div style="padding:24px">
        <button onclick="toggleDarkMode()" style="width:100%;padding:14px;border-radius:12px;background:var(--glass);border:1px solid var(--glass-border)">${document.body.classList.contains('dark') ? '☀️ Light' : '🌙 Dark'} Mode</button>
      </div>
    </aside>`;
}

const views = {
  dashboard(c) {
    const progress = c.chapters?.length ? Math.round(c.chapters.reduce((a,ch)=>a+(ch.done/ch.total),0)/c.chapters.length*100) : 0;
    return `
      <div class="glass-panel" style="min-height:440px;position:relative;overflow:hidden">
        <canvas id="hero-canvas" width="1600" height="440" style="position:absolute;inset:0"></canvas>
        <div style="position:relative;z-index:2">
          <h1>Welcome back, Akshat 👋</h1>
          <p style="font-size:1.35rem;color:var(--muted)">Current Vault: <strong>${currentVault}</strong></p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-top:32px">
        <div class="glass-panel"><h2>Progress</h2><strong style="font-size:4.5rem">${progress}%</strong></div>
        <div class="glass-panel"><h2>Tasks</h2><strong style="font-size:4.5rem">${c.plans?.length||0}</strong></div>
        <div class="glass-panel"><h2>Exams</h2><strong style="font-size:4.5rem">${c.exams?.length||0}</strong></div>
      </div>`;
  },

  chapters(c) { /* same as before */ 
    return `... (full chapters view from previous messages) ...`;
  },

  // Add other views similarly (formulas, planner, exams)

  timers() {
    return `
      <div class="glass-panel" style="max-width:760px;margin:40px auto">
        <h1 style="margin-bottom:8px">Focus Mode</h1>
        <div class="timer-face" id="timerDisplay">${formatTime(timer.remaining)}</div>
        <div style="text-align:center;margin:32px 0">
          <button onclick="startTimer()" class="btn-primary">Start</button>
          <button onclick="pauseTimer()">Pause</button>
          <button onclick="resetTimer()">Reset</button>
        </div>

        <!-- Flight Timer -->
        <div class="glass-panel" style="margin-top:24px">
          <h3>Flight Timer</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;margin-top:16px">
            <select id="fromAirport" style="padding:12px;border-radius:12px">${airports.map(a=>`<option value="${a.code}">${a.code} - ${a.city}</option>`).join('')}</select>
            <select id="toAirport" style="padding:12px;border-radius:12px">${airports.map(a=>`<option value="${a.code}">${a.code} - ${a.city}</option>`).join('')}</select>
            <button onclick="loadFlightTimer()" class="btn-primary">Load Flight</button>
          </div>
          <div id="flightInfo" style="margin-top:12px;color:var(--muted)"></div>
        </div>

        <!-- Audio -->
        <div class="audio-glass" style="margin-top:24px">
          <h3>Ambient Sounds</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:16px 0">
            <button onclick="playAmbient('white')">White Noise</button>
            <button onclick="playAmbient('rain')">Rain</button>
            <button onclick="playAmbient('cabin')">Cabin</button>
            <button onclick="playBinaural('alpha')">Alpha</button>
            <button onclick="playBinaural('theta')">Theta</button>
          </div>
          <input type="file" id="customMusic" accept="audio/*" style="width:100%;margin:12px 0">
          <div style="display:flex;align-items:center;gap:12px">
            <span>Volume</span>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.75" style="flex:1">
          </div>
        </div>
      </div>`;
  }
};

// Add all other functions (particles, audio, flight timer, etc.) from previous messages.

loadFromStorage();
render();
</script>
</body>
</html>
