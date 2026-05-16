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
.glass-panel {
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
const $ = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];

const VAULTS = ["JEE","NEET","Boards"];
let currentVault = "JEE";
let activeView = "dashboard";

let state = { JEE:{}, NEET:{}, Boards:{} };

let timer = {total:45*60, remaining:45*60, running:false};
let timerInterval = null;
let audio = {player:null, ctx:null};

const airports = [
  ["DEL","Delhi","India",28.5562,77.1],["BOM","Mumbai","India",19.0896,72.8656],
  ["BLR","Bengaluru","India",13.1986,77.7066],["MAA","Chennai","India",12.9941,80.1709],
  ["CCU","Kolkata","India",22.6547,88.4467],["HYD","Hyderabad","India",17.2403,78.4294],
  ["DXB","Dubai","UAE",25.2532,55.3657],["LHR","London","UK",51.47,-0.4543],
  ["JFK","New York","USA",40.6413,-73.7781],["SIN","Singapore","Singapore",1.3644,103.9915]
].map(([code,city,country,lat,lon])=>({code,city,country,lat,lon}));

function loadFromStorage() {
  const saved = localStorage.getItem("studypilot_data");
  if (saved) {
    const data = JSON.parse(saved);
    state = data.state || state;
    currentVault = data.currentVault || "JEE";
  } else {
    state.JEE = {
      chapters: [{id:"c1",subject:"Physics",name:"Kinematics",done:6,total:8}],
      exams: [{id:"e1",name:"JEE Main Attempt 1",date:"2026-01-20"}],
      plans: [{title:"Complete Kinematics problems",done:false}],
      formulas: [{title:"Kinematics Equations",subject:"Physics",content:"v = u + at\ns = ut + ½at²"}]
    };
  }
}

function saveToStorage() {
  localStorage.setItem("studypilot_data", JSON.stringify({state, currentVault}));
}

function commit(fn) {
  fn(state[currentVault]);
  saveToStorage();
  render();
}

function formatTime(s) {
  const m = Math.floor(s/60), sec = s%60;
  return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}
function daysLeft(date) {
  return Math.max(0, Math.ceil((new Date(date) - new Date()) / 86400000));
}

function haversine(lat1,lon1,lat2,lon2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// ==================== RENDER ====================
function render() {
  const c = state[currentVault] || {};
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

  chapters(c) {
    return `
      <div class="glass-panel">
        <h1 style="margin-bottom:24px">Chapters</h1>
        <form id="addChapterForm" style="display:grid;grid-template-columns:2fr 1fr auto;gap:12px;margin-bottom:28px">
          <input id="chName" placeholder="Chapter Name" required>
          <select id="chSubject"><option>Physics</option><option>Chemistry</option><option>Math</option><option>Biology</option></select>
          <button type="submit" class="btn-primary">Add Chapter</button>
        </form>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px">
          ${c.chapters.map((ch,i) => {
            const pct = Math.round((ch.done/ch.total)*100);
            return `
              <div class="glass-panel">
                <strong>${ch.name}</strong> <small>(${ch.subject})</small>
                <div style="height:12px;background:#e2e8f0;border-radius:9999px;margin:16px 0;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#3b82f6,#60a5fa);transition:width 0.6s"></div>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span>${ch.done}/${ch.total}</span>
                  <div>
                    <button onclick="updateChapter(${i},-1)">–</button>
                    <button onclick="updateChapter(${i},1)">+</button>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  formulas(c) {
    return `
      <div class="glass-panel">
        <h1 style="margin-bottom:24px">Formula Bank</h1>
        <form id="addFormulaForm" style="margin-bottom:32px">
          <input id="fTitle" placeholder="Title" style="width:100%;padding:14px;margin-bottom:12px" required>
          <select id="fSubject" style="width:100%;padding:14px;margin-bottom:12px">
            <option>Physics</option><option>Chemistry</option><option>Math</option><option>Biology</option>
          </select>
          <textarea id="fContent" rows="6" placeholder="Formulas..." style="width:100%;padding:14px" required></textarea>
          <button type="submit" class="btn-primary">Save Formula</button>
        </form>
        ${c.formulas.map((f,i)=>`
          <div class="glass-panel" style="margin-bottom:16px">
            <strong>${f.title}</strong> <small>(${f.subject})</small>
            <pre style="background:#f8fafc;padding:16px;border-radius:12px;margin:12px 0;white-space:pre-wrap">${f.content}</pre>
            <button onclick="deleteFormula(${i})" style="color:var(--red)">Delete</button>
          </div>`).join('')}
      </div>`;
  },

  planner(c) {
    return `
      <div class="glass-panel">
        <h1 style="margin-bottom:24px">Daily Planner</h1>
        <div id="planList">${(c.plans||[]).map((p,i)=>`
          <div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #e2e8f0">
            <input type="checkbox" ${p.done?'checked':''} onchange="togglePlan(${i})">
            <span style="${p.done?'text-decoration:line-through;opacity:0.6':''}">${p.title}</span>
            <button onclick="deletePlan(${i})" style="margin-left:auto;color:var(--red)">×</button>
          </div>`).join('') || '<p>No tasks yet.</p>'}</div>
        <form id="addPlanForm" style="margin-top:24px;display:flex;gap:12px">
          <input id="planInput" placeholder="New task..." style="flex:1;padding:14px" required>
          <button type="submit" class="btn-primary">Add</button>
        </form>
      </div>`;
  },

  exams(c) {
    return `
      <div class="glass-panel">
        <h1 style="margin-bottom:24px">Exam Schedule</h1>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px">
          ${(c.exams||[]).map((ex,i)=>`
            <div class="glass-panel">
              <strong>${ex.name}</strong><br>
              <span style="color:var(--muted)">${ex.date} — ${daysLeft(ex.date)} days left</span>
              <button onclick="deleteExam(${i})" style="float:right;color:var(--red)">Delete</button>
            </div>`).join('')}
        </div>
        <form id="addExamForm" style="margin-top:32px;display:grid;grid-template-columns:2fr 1fr auto;gap:12px">
          <input id="exName" placeholder="Exam Name" required>
          <input type="date" id="exDate" required>
          <button type="submit" class="btn-primary">Add Exam</button>
        </form>
      </div>`;
  },

  timers() {
    return `
      <div class="glass-panel" style="max-width:760px;margin:40px auto">
        <h1 style="margin-bottom:8px">Focus Mode</h1>
        <p style="color:var(--muted);margin-bottom:32px">The place where greatness is built.</p>
        
        <div class="timer-face" id="timerDisplay">${formatTime(timer.remaining)}</div>

        <div style="text-align:center;margin:32px 0">
          <button onclick="startTimer()" class="btn-primary" style="font-size:1.1rem;padding:16px 40px">▶ Start Session</button>
          <button onclick="pauseTimer()" style="margin:0 8px;padding:16px 28px;background:#64748b;color:white;border-radius:12px">Pause</button>
          <button onclick="resetTimer()" style="padding:16px 28px;background:#ef4444;color:white;border-radius:12px">Reset</button>
        </div>

        <!-- Flight Timer -->
        <div class="glass-panel" style="margin-top:24px">
          <h3>Flight Timer</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;margin-top:16px">
            <select id="fromAirport" style="padding:12px;border-radius:12px">
              ${airports.map(a => `<option value="${a.code}">${a.code} - ${a.city}</option>`).join('')}
            </select>
            <select id="toAirport" style="padding:12px;border-radius:12px">
              ${airports.map(a => `<option value="${a.code}">${a.code} - ${a.city}</option>`).join('')}
            </select>
            <button onclick="loadFlightTimer()" class="btn-primary">Load Flight</button>
          </div>
          <div id="flightInfo" style="margin-top:12px;color:var(--muted)"></div>
        </div>

        <!-- Audio -->
        <div class="audio-glass" style="margin-top:24px">
          <h3 style="margin-bottom:16px">🎵 Ambient Soundscape</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:20px">
            <button onclick="playAmbient('white')" style="padding:12px;border-radius:12px">White Noise</button>
            <button onclick="playAmbient('rain')" style="padding:12px;border-radius:12px">Rain</button>
            <button onclick="playAmbient('cabin')" style="padding:12px;border-radius:12px">Cabin</button>
            <button onclick="playBinaural('alpha')" style="padding:12px;border-radius:12px">Alpha Waves</button>
            <button onclick="playBinaural('theta')" style="padding:12px;border-radius:12px">Theta Waves</button>
          </div>
          <input type="file" id="customMusic" accept="audio/*" style="width:100%;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px">
            <span>Volume</span>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.75" style="flex:1">
          </div>
        </div>
      </div>`;
  }
};

// ==================== PARTICLES & AUDIO & TIMER ====================
function initParticles() {
  const canvas = $("#hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = 1600; canvas.height = 440;
  let particles = [];
  for (let i = 0; i < 120; i++) {
    particles.push({x:Math.random()*1600, y:Math.random()*440, size:Math.random()*3+1.5, sx:Math.random()*0.8-0.4, sy:Math.random()*0.8-0.4});
  }
  function animate() {
    ctx.clearRect(0,0,1600,440);
    particles.forEach(p => {
      p.x += p.sx; p.y += p.sy;
      if (p.x<0||p.x>1600) p.sx*=-1;
      if (p.y<0||p.y>440) p.sy*=-1;
      ctx.fillStyle = "rgba(59,130,246,0.7)";
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
}

function initAudioPlayer() {
  const slider = $("#volumeSlider");
  if (slider) slider.oninput = () => { if(audio.player) audio.player.volume = parseFloat(slider.value); };

  $("#customMusic").onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    stopAudio();
    audio.player = new Audio(URL.createObjectURL(file));
    audio.player.loop = true;
    audio.player.volume = parseFloat(slider.value);
    audio.player.play();
  };
}

window.playAmbient = (type) => {
  stopAudio();
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.55;
  gain.connect(audio.ctx.destination);

  const bufferSize = audio.ctx.sampleRate * 4;
  const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    if (type === 'white') data[i] = Math.random() * 2 - 1;
    else if (type === 'rain') data[i] = (Math.random() - 0.5) * (i % 70 < 12 ? 1.8 : 0.4);
    else if (type === 'cabin') data[i] = (Math.random() - 0.5) * 0.65 + Math.sin(i/250)*0.2;
  }

  const source = audio.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  source.start();
  audio.player = source;
};

window.playBinaural = (type) => {
  stopAudio();
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.55;
  gain.connect(audio.ctx.destination);

  const o1 = audio.ctx.createOscillator();
  const o2 = audio.ctx.createOscillator();
  o1.type = o2.type = 'sine';
  o1.frequency.value = type === 'alpha' ? 200 : 180;
  o2.frequency.value = type === 'alpha' ? 210 : 194;
  o1.connect(gain); o2.connect(gain);
  o1.start(); o2.start();
  audio.player = { pause: () => { o1.stop(); o2.stop(); } };
};

window.stopAudio = () => {
  if (audio.player) {
    if (audio.ctx) audio.ctx.close();
    else if (audio.player.pause) audio.player.pause();
  }
};

window.loadFlightTimer = () => {
  const fromCode = $("#fromAirport").value;
  const toCode = $("#toAirport").value;
  const from = airports.find(a => a.code === fromCode);
  const to = airports.find(a => a.code === toCode);

  if (!from || !to) return;

  const km = haversine(from.lat, from.lon, to.lat, to.lon);
  const minutes = Math.round(Math.max(30, (km / 840) * 60 + 35));
  const seconds = minutes * 60;

  timer.total = timer.remaining = seconds;
  timer.running = false;
  if (timerInterval) clearInterval(timerInterval);

  const info = $("#flightInfo");
  if (info) info.innerHTML = `<strong>${from.code} → ${to.code}</strong> • ${Math.round(km)} km • ${minutes} minutes`;

  const el = $("#timerDisplay");
  if (el) el.textContent = formatTime(seconds);
};

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timerInterval = setInterval(() => {
    timer.remaining--;
    const el = $("#timerDisplay");
    if (el) el.textContent = formatTime(timer.remaining);
    if (timer.remaining <= 0) { pauseTimer(); alert("🎉 Great session!"); }
  }, 1000);
}
function pauseTimer() { clearInterval(timerInterval); timer.running = false; }
function resetTimer() { pauseTimer(); timer.remaining = timer.total; const el = $("#timerDisplay"); if(el) el.textContent = formatTime(timer.remaining); }

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  render();
}

function switchVault(v) {
  currentVault = v;
  saveToStorage();
  render();
}

function bindEvents() {
  $$("[data-view]").forEach(btn => btn.addEventListener("click", () => {
    activeView = btn.dataset.view;
    render();
  }));

  $("#addChapterForm")?.addEventListener("submit", e => { e.preventDefault(); commit(s => s.chapters.push({id:Date.now(),subject:$("#chSubject").value,name:$("#chName").value,done:0,total:10})); e.target.reset(); });
  $("#addFormulaForm")?.addEventListener("submit", e => { e.preventDefault(); commit(s => s.formulas.push({title:$("#fTitle").value,subject:$("#fSubject").value,content:$("#fContent").value})); e.target.reset(); });
  $("#addPlanForm")?.addEventListener("submit", e => { e.preventDefault(); commit(s => s.plans.push({title:$("#planInput").value,done:false})); $("#planInput").value = ""; });
  $("#addExamForm")?.addEventListener("submit", e => { e.preventDefault(); commit(s => s.exams.push({id:Date.now(),name:$("#exName").value,date:$("#exDate").value})); e.target.reset(); });
}

window.switchVault = switchVault;
window.toggleDarkMode = toggleDarkMode;
window.updateChapter = (i,d) => commit(s => { const ch = s.chapters[i]; ch.done = Math.max(0, Math.min(ch.total, ch.done + d)); });
window.deleteFormula = i => commit(s => s.formulas.splice(i,1));
window.togglePlan = i => commit(s => s.plans[i].done = !s.plans[i].done);
window.deletePlan = i => commit(s => s.plans.splice(i,1));
window.deleteExam = i => { if(confirm("Delete exam?")) commit(s => s.exams.splice(i,1)); };
window.startTimer = startTimer;
window.pauseTimer = pauseTimer;
window.resetTimer = resetTimer;
window.playBinaural = playBinaural;
window.stopAudio = stopAudio;
window.playAmbient = playAmbient;
window.loadFlightTimer = loadFlightTimer;

loadFromStorage();
render();
</script>
</body>
</html>
