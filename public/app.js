const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const subjects = ["Physics", "Chemistry", "Math"];
const airports = [
  ["DEL", "Delhi", "India", 28.5562, 77.1],
  ["BOM", "Mumbai", "India", 19.0896, 72.8656],
  ["BLR", "Bengaluru", "India", 13.1986, 77.7066],
  ["MAA", "Chennai", "India", 12.9941, 80.1709],
  ["CCU", "Kolkata", "India", 22.6547, 88.4467],
  ["HYD", "Hyderabad", "India", 17.2403, 78.4294],
  ["DXB", "Dubai", "UAE", 25.2532, 55.3657],
  ["DOH", "Doha", "Qatar", 25.2731, 51.6081],
  ["SIN", "Singapore", "Singapore", 1.3644, 103.9915],
  ["HND", "Tokyo Haneda", "Japan", 35.5494, 139.7798],
  ["NRT", "Tokyo Narita", "Japan", 35.772, 140.3929],
  ["ICN", "Seoul", "South Korea", 37.4602, 126.4407],
  ["LHR", "London Heathrow", "United Kingdom", 51.47, -0.4543],
  ["CDG", "Paris", "France", 49.0097, 2.5479],
  ["FRA", "Frankfurt", "Germany", 50.0379, 8.5622],
  ["AMS", "Amsterdam", "Netherlands", 52.3105, 4.7683],
  ["IST", "Istanbul", "Turkey", 41.2753, 28.7519],
  ["JFK", "New York JFK", "United States", 40.6413, -73.7781],
  ["EWR", "Newark", "United States", 40.6895, -74.1745],
  ["LAX", "Los Angeles", "United States", 33.9416, -118.4085],
  ["SFO", "San Francisco", "United States", 37.6213, -122.379],
  ["ORD", "Chicago O'Hare", "United States", 41.9742, -87.9073],
  ["ATL", "Atlanta", "United States", 33.6407, -84.4277],
  ["DFW", "Dallas Fort Worth", "United States", 32.8998, -97.0403],
  ["YYZ", "Toronto", "Canada", 43.6777, -79.6248],
  ["YVR", "Vancouver", "Canada", 49.1967, -123.1815],
  ["SYD", "Sydney", "Australia", -33.9399, 151.1753],
  ["MEL", "Melbourne", "Australia", -37.669, 144.841],
  ["AKL", "Auckland", "New Zealand", -37.0082, 174.785],
  ["CPT", "Cape Town", "South Africa", -33.9715, 18.6021],
  ["JNB", "Johannesburg", "South Africa", -26.1337, 28.242],
  ["GRU", "Sao Paulo", "Brazil", -23.4356, -46.4731],
  ["EZE", "Buenos Aires", "Argentina", -34.8222, -58.5358],
  ["MEX", "Mexico City", "Mexico", 19.4361, -99.0719],
  ["CAI", "Cairo", "Egypt", 30.112, 31.4]
].map(([code, city, country, lat, lon]) => ({ code, city, country, lat, lon }));

let state = null;
let activeView = "dashboard";
let activeSubject = "Physics";
let statsTab = "mocks";
let saveTimer = null;
let countdownInterval = null;
let timerInterval = null;
let timer = { total: 45 * 60, remaining: 45 * 60, running: false, startedAt: 0 };
let audio = { ctx: null, nodes: [], mode: null };

const icons = {
  dashboard: icon("M4 15a8 8 0 0 1 16 0M12 15l4-6M4 15h16"),
  files: icon("M3 6h7l2 2h9v10H3z"),
  chapters: icon("M4 5h7a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H4zM14 8a3 3 0 0 1 3-3h3v14h-3a3 3 0 0 0-3 3z"),
  planner: icon("M5 4v4M19 4v4M4 8h16M5 6h14v14H5z"),
  timers: icon("M9 2h6M12 8v5l3 2M5 13a7 7 0 1 0 14 0a7 7 0 0 0-14 0"),
  stats: icon("M5 19V9h3v10M11 19V5h3v14M17 19v-7h3v7M3 19h19")
};

function icon(pathData) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${pathData}"/></svg>`;
}

async function boot() {
  const res = await fetch("/api/state");
  state = await res.json();
  document.body.classList.toggle("dark", !!state.settings.darkMode);
  render();
  countdownInterval = setInterval(updateCountdowns, 30000);
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
  }, 250);
}

function allAirports() {
  return airports.concat(state.settings.customAirports || []);
}

function commit(mutator, rerender = true) {
  mutator(state);
  persist();
  if (rerender) render();
}

function render() {
  const shellClass = state.settings.sidebarCollapsed ? "app-shell collapsed" : "app-shell";
  $("#app").innerHTML = `
    <div class="${shellClass}">
      ${renderSidebar()}
      <main class="content">
        <div class="topbar">
          <button class="icon-only mobile-menu" data-mobile-menu aria-label="Open navigation">${icon("M4 7h16M4 12h16M4 17h16")}</button>
          <span class="eyebrow">${new Date().toISOString().slice(0, 10)} · JEE command center</span>
          <div class="actions">
            <button class="outline-btn" data-collapse>${state.settings.sidebarCollapsed ? "Open Panel" : "Collapse Panel"}</button>
            <button class="outline-btn" data-dark>${state.settings.darkMode ? "Light Mode" : "Dark Mode"}</button>
          </div>
        </div>
        ${views[activeView]()}
      </main>
    </div>
  `;
  bindGlobal();
  if (activeView === "dashboard" || activeView === "stats") requestAnimationFrame(drawCharts);
  if (activeView === "dashboard") updateCountdowns();
  if (activeView === "timers") updateTimerFace();
}

function renderSidebar() {
  const nav = [
    ["dashboard", "Dashboard"],
    ["files", "Files"],
    ["chapters", "Chapters"],
    ["planner", "Planner"],
    ["timers", "Timers"],
    ["stats", "Stats"]
  ];
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">JP</div>
        <div class="brand-copy">
          <p class="brand-name">JEEPILOT</p>
          <span class="eyebrow">Study Vault v1.0</span>
        </div>
      </div>
      <nav class="nav">
        ${nav.map(([id, label]) => `
          <button class="${activeView === id ? "active" : ""}" data-view="${id}" title="${label}">
            <span class="nav-icon">${icons[id]}</span>
            <span class="nav-label">${label}</span>
          </button>
        `).join("")}
      </nav>
      <div class="account">
        <span class="eyebrow">Signed in</span>
        <p class="email">admin@jeepilot.com</p>
        <button class="outline-btn" type="button">Sign Out</button>
      </div>
    </aside>
  `;
}

const views = {
  dashboard() {
    const totals = getTotals();
    return `
      <section class="page-head">
        <span class="eyebrow">Cockpit</span>
        <h1>Hello,<br>${escapeHtml(state.settings.name)}.<br><span class="small">Let's fly.</span></h1>
      </section>
      <section class="grid four">
        <div class="panel metric"><span>Files stored</span><strong>${state.files.length}</strong></div>
        <div class="panel metric"><span>Average syllabus</span><strong>${totals.chapterPercent}%</strong></div>
        <div class="panel metric"><span>Questions done</span><strong>${totals.questions}</strong></div>
        <div class="panel metric"><span>Hours last 7 days</span><strong>${Math.round(totals.weekMinutes / 60)}</strong></div>
      </section>
      <section class="grid two" style="margin-top:18px">
        <div class="panel">
          <h2>Attempt countdowns</h2>
          <div class="countdown-list">${renderCountdowns()}</div>
          <form id="examDateForm" class="form-grid three-cols" style="margin-top:18px">
            <div class="field"><label>Main 1</label><input type="date" name="main1" value="${state.settings.examDates.main1}"></div>
            <div class="field"><label>Main 2</label><input type="date" name="main2" value="${state.settings.examDates.main2}"></div>
            <div class="field"><label>Advanced</label><input type="date" name="advanced" value="${state.settings.examDates.advanced}"></div>
            <button class="outline-btn" type="submit">Update Dates</button>
          </form>
        </div>
        <div class="panel">
          <h2>Study activity: last three months</h2>
          ${renderHeatmap()}
        </div>
        <div class="panel">
          <h2>Marks trend</h2>
          <canvas class="chart" id="marksChart" width="680" height="260"></canvas>
        </div>
        <div class="panel">
          <h2>Daily study hours</h2>
          <canvas class="chart" id="hoursChart" width="680" height="260"></canvas>
        </div>
      </section>
    `;
  },
  files() {
    return `
      <section class="page-head">
        <span class="eyebrow">Study Vault</span>
        <h1>Files.</h1>
        <p>Store PDFs, notes, images, and question sets in this local vault. Uploads are saved by the backend in this project folder.</p>
      </section>
      <section class="grid two">
        <div class="panel">
          <form id="uploadForm" class="dropzone">
            <div>
              <strong>Drop or click to upload</strong>
              <p class="small">PDF · images · notes · any file</p>
              <input id="fileInput" name="file" type="file" class="hidden" />
              <button class="primary-btn" type="button" data-pick-file>Choose File</button>
            </div>
          </form>
        </div>
        <div class="panel tight">
          <div class="file-row header"><span>Name</span><span>Size</span><span>Uploaded</span><span></span><span></span></div>
          ${state.files.length ? state.files.map(renderFile).join("") : `<div class="panel"><p class="small">No files yet. Your first upload will appear here.</p></div>`}
        </div>
      </section>
    `;
  },
  chapters() {
    const filtered = state.chapters.filter((item) => item.subject === activeSubject);
    return `
      <section class="page-head">
        <span class="eyebrow">Syllabus Grid</span>
        <h1>Chapters.</h1>
      </section>
      <div class="tabs">${subjects.map((subject) => `<button class="${subject === activeSubject ? "active" : ""}" data-subject="${subject}">${subject}</button>`).join("")}</div>
      <section class="panel tight" style="margin-top:18px">
        <div class="chapter-row header"><span>Chapter</span><span>Topics</span><span>Progress</span><span>Done</span><span></span></div>
        ${filtered.map(renderChapter).join("")}
        <form id="chapterForm" class="chapter-row">
          <input name="name" placeholder="New chapter name" required />
          <input name="topicsTotal" type="number" min="1" value="5" required />
          <span class="small">Subject: ${activeSubject}</span>
          <button class="primary-btn" type="submit">Add</button>
        </form>
      </section>
    `;
  },
  planner() {
    const today = todayIso();
    const todayPlans = state.plans.filter((item) => item.date === today);
    const objectives = state.objectives.filter((item) => item.date === today);
    return `
      <section class="page-head">
        <span class="eyebrow">Daily Flight Plan</span>
        <h1>Planner.</h1>
      </section>
      <section class="plan-layout">
        <div class="panel">
          <h2>Today</h2>
          ${objectives.map(renderObjective).join("") || `<p class="small">No objective added yet.</p>`}
          <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
          ${todayPlans.map(renderPlan).join("") || `<p class="small">No tasks planned yet.</p>`}
        </div>
        <aside class="panel">
          <h2>Add from the side</h2>
          <form id="objectiveForm" class="field" style="margin-bottom:18px">
            <label>Day objective</label>
            <textarea name="text" placeholder="What does a good study day look like?"></textarea>
            <button class="primary-btn" type="submit">Add Objective</button>
          </form>
          <form id="planForm" class="field">
            <label>Plan item</label>
            <input name="title" placeholder="e.g. 40 questions from limits" required />
            <label>Subject</label>
            <select name="subject">${subjects.map((s) => `<option>${s}</option>`).join("")}</select>
            <button class="primary-btn" type="submit">Add Plan</button>
          </form>
        </aside>
      </section>
    `;
  },
  timers() {
    const airportList = allAirports();
    const renderAirportOptions = (selected) => airportList.map((a) => `<option value="${a.code}" ${a.code === selected ? "selected" : ""}>${a.code} · ${a.city}, ${a.country}</option>`).join("");
    return `
      <section class="page-head">
        <span class="eyebrow">Focus Flight Deck</span>
        <h1>Timers.</h1>
        <p>Pick two airports and the app converts estimated flight time into your study timer. You can also type a manual duration when you want a normal session.</p>
      </section>
      <section class="grid two">
        <div class="panel">
          <h2>Flight timer</h2>
          <form id="flightForm" class="form-grid three-cols">
            <div class="field"><label>Depart</label><select name="from">${renderAirportOptions("DEL")}</select></div>
            <div class="field"><label>Arrive</label><select name="to">${renderAirportOptions("LHR")}</select></div>
            <button class="primary-btn" type="submit">Load Flight</button>
          </form>
          <p class="small" id="flightInfo" style="margin-top:12px"></p>
          <div class="timer-face" style="margin-top:18px">
            <div>
              <span class="eyebrow">Current session</span>
              <strong id="timerDisplay">00:45:00</strong>
              <p class="small" id="timerSub">Ready for takeoff.</p>
            </div>
          </div>
          <div class="timer-controls">
            <button class="primary-btn" data-timer-start>Start</button>
            <button class="outline-btn" data-timer-pause>Pause</button>
            <button class="outline-btn" data-timer-reset>Reset</button>
            <button class="outline-btn" data-log-session>Log Session</button>
          </div>
          <form id="manualTimerForm" class="form-grid three-cols" style="margin-top:18px">
            <div class="field"><label>Manual minutes</label><input type="number" min="1" max="900" name="minutes" value="45"></div>
            <button class="outline-btn" type="submit">Load Manual</button>
          </form>
          <form id="airportForm" class="form-grid" style="margin-top:16px">
            <div class="field"><label>IATA</label><input name="code" maxlength="4" placeholder="ABC" required></div>
            <div class="field"><label>Airport / City</label><input name="city" placeholder="Your airport" required></div>
            <div class="field"><label>Latitude</label><input name="lat" type="number" step="0.0001" placeholder="28.5562" required></div>
            <div class="field"><label>Longitude</label><input name="lon" type="number" step="0.0001" placeholder="77.1000" required></div>
            <button class="outline-btn" type="submit">Add Airport</button>
          </form>
          <p class="small">The built-in list covers major airports. Add any other airport with its coordinates and it becomes available in the flight timer.</p>
        </div>
        <div class="panel">
          <h2>White noise & focus music</h2>
          <div class="audio-pad">
            ${["white", "brown", "rain", "focus"].map((mode) => `<button data-audio="${mode}" class="${audio.mode === mode ? "active" : ""}">${modeLabel(mode)}</button>`).join("")}
          </div>
          <div class="timer-controls">
            <button class="danger-btn" data-audio-stop>Stop Audio</button>
          </div>
          <p class="small">Generated in your browser with Web Audio, so it works even without music files.</p>
        </div>
      </section>
    `;
  },
  stats() {
    const totals = getTotals();
    return `
      <section class="page-head">
        <span class="eyebrow">Performance</span>
        <h1>Stats.</h1>
      </section>
      <section class="grid three">
        <div class="panel metric"><span>Mocks logged</span><strong>${state.stats.mocks.length}</strong></div>
        <div class="panel metric"><span>Questions done</span><strong>${totals.questions}</strong></div>
        <div class="panel metric"><span>Errors open</span><strong style="color:var(--red)">${state.stats.errors.filter((e) => !e.fixed).length}</strong></div>
      </section>
      <section class="grid two" style="margin-top:18px">
        <div class="panel"><h2>Marks graph</h2><canvas class="chart" id="marksChart" width="680" height="260"></canvas></div>
        <div class="panel"><h2>Daily hours graph</h2><canvas class="chart" id="hoursChart" width="680" height="260"></canvas></div>
      </section>
      <div class="tabs" style="margin-top:18px">
        ${["mocks", "questions", "errors"].map((tab) => `<button class="${statsTab === tab ? "active" : ""}" data-stats-tab="${tab}">${tab}</button>`).join("")}
      </div>
      <section class="panel" style="margin-top:18px">${renderStatsTab()}</section>
    `;
  }
};

function renderCountdowns() {
  const labels = [
    ["JEE Main Attempt 1", state.settings.examDates.main1],
    ["JEE Main Attempt 2", state.settings.examDates.main2],
    ["JEE Advanced", state.settings.examDates.advanced]
  ];
  return labels.map(([label, date]) => `
    <div class="countdown" data-countdown="${date}">
      <div class="rail"></div>
      <div class="countdown-body">
        <span class="eyebrow">${label}</span>
        <strong class="days">--</strong>
        <span class="small">${formatDate(date)}</span>
      </div>
    </div>
  `).join("");
}

function renderHeatmap() {
  const byDate = new Map();
  state.stats.sessions.forEach((s) => byDate.set(s.date, (byDate.get(s.date) || 0) + Number(s.minutes || 0)));
  const cells = [];
  const today = new Date();
  for (let i = 90; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const minutes = byDate.get(key) || 0;
    const level = minutes === 0 ? 0 : minutes < 45 ? 1 : minutes < 90 ? 2 : minutes < 150 ? 3 : 4;
    cells.push(`<div class="heat-cell level-${level}" title="${key}: ${Math.round(minutes / 60 * 10) / 10}h"></div>`);
  }
  return `<div class="heatmap">${cells.join("")}</div>`;
}

function renderFile(file) {
  return `
    <div class="file-row">
      <strong>${escapeHtml(file.name)}</strong>
      <span class="small">${formatSize(file.size)}</span>
      <span class="small">${new Date(file.uploadedAt).toLocaleString()}</span>
      <a class="outline-btn" href="/api/files/${file.id}">Open</a>
      <button class="danger-btn" data-delete-file="${file.id}">Delete</button>
    </div>
  `;
}

function renderChapter(item) {
  const pct = Math.round((item.topicsDone / Math.max(1, item.topicsTotal)) * 100);
  return `
    <div class="chapter-row">
      <strong>${escapeHtml(item.name)}</strong>
      <div class="stepper">
        <button data-chapter-step="${item.id}" data-step="-1">-</button>
        <span>${item.topicsDone}/${item.topicsTotal}</span>
        <button data-chapter-step="${item.id}" data-step="1">+</button>
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <span>${pct}%</span>
      <button class="danger-btn" data-delete-chapter="${item.id}">Delete</button>
    </div>
  `;
}

function renderPlan(item) {
  return `
    <div class="check-row ${item.done ? "done" : ""}">
      <input type="checkbox" ${item.done ? "checked" : ""} data-toggle-plan="${item.id}">
      <div><strong class="title">${escapeHtml(item.title)}</strong><br><span class="pill">${item.subject}</span></div>
      <button class="danger-btn" data-delete-plan="${item.id}">Delete</button>
    </div>
  `;
}

function renderObjective(item) {
  return `
    <div class="check-row ${item.done ? "done" : ""}">
      <input type="checkbox" ${item.done ? "checked" : ""} data-toggle-objective="${item.id}">
      <div><span class="eyebrow">Objective</span><strong class="title">${escapeHtml(item.text)}</strong></div>
      <button class="danger-btn" data-delete-objective="${item.id}">Delete</button>
    </div>
  `;
}

function renderStatsTab() {
  if (statsTab === "mocks") {
    return `
      <h2>Mock test history</h2>
      <form id="mockForm" class="form-grid">
        <div class="field"><label>Date</label><input name="date" type="date" value="${todayIso()}" required></div>
        <div class="field"><label>Exam</label><input name="exam" value="JEE Main Mock" required></div>
        <div class="field"><label>Total marks</label><input name="marks" type="number" min="0" max="300" required></div>
        <button class="primary-btn" type="submit">Add Mock</button>
      </form>
      ${table(["Date", "Exam", "Marks", "Notes"], state.stats.mocks.map((m) => [m.date, m.exam, m.marks, m.notes || ""]))}
    `;
  }
  if (statsTab === "questions") {
    return `
      <h2>Daily questions</h2>
      <form id="questionForm" class="form-grid">
        <div class="field"><label>Date</label><input name="date" type="date" value="${todayIso()}" required></div>
        <div class="field"><label>Subject</label><select name="subject">${subjects.map((s) => `<option>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Count</label><input name="count" type="number" min="1" required></div>
        <button class="primary-btn" type="submit">Add Questions</button>
      </form>
      ${table(["Date", "Subject", "Count", "Correct"], state.stats.questions.map((q) => [q.date, q.subject, q.count, q.correct || "-"]))}
    `;
  }
  return `
    <h2>Error tracker</h2>
    <form id="errorForm" class="form-grid">
      <div class="field"><label>Subject</label><select name="subject">${subjects.map((s) => `<option>${s}</option>`).join("")}</select></div>
      <div class="field"><label>Chapter</label><input name="chapter" placeholder="Chapter" required></div>
      <div class="field"><label>Error</label><input name="note" placeholder="What went wrong?" required></div>
      <button class="primary-btn" type="submit">Track Error</button>
    </form>
    ${table(["Date", "Subject", "Chapter", "Error", "Fixed"], state.stats.errors.map((e) => [e.date, e.subject, e.chapter, e.note, `<input type="checkbox" ${e.fixed ? "checked" : ""} data-toggle-error="${e.id}">`]))}
  `;
}

function table(headers, rows) {
  return `
    <div style="overflow:auto;margin-top:18px">
      <table class="table">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function bindGlobal() {
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => {
    activeView = button.dataset.view;
    document.body.classList.remove("nav-open");
    render();
  }));
  $("[data-collapse]")?.addEventListener("click", () => commit((s) => s.settings.sidebarCollapsed = !s.settings.sidebarCollapsed));
  $("[data-dark]")?.addEventListener("click", () => commit((s) => {
    s.settings.darkMode = !s.settings.darkMode;
    document.body.classList.toggle("dark", s.settings.darkMode);
  }));
  $("[data-mobile-menu]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    document.body.classList.add("nav-open");
  });
  $(".content")?.addEventListener("click", () => document.body.classList.remove("nav-open"));

  bindFiles();
  bindChapters();
  bindPlanner();
  bindTimers();
  bindStats();
  bindDashboard();
}

function bindDashboard() {
  $("#examDateForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => {
      s.settings.examDates.main1 = data.main1;
      s.settings.examDates.main2 = data.main2;
      s.settings.examDates.advanced = data.advanced;
    });
  });
}

function bindFiles() {
  const form = $("#uploadForm");
  const input = $("#fileInput");
  if (!form || !input) return;
  $("[data-pick-file]")?.addEventListener("click", () => input.click());
  input.addEventListener("change", () => uploadFile(input.files[0]));
  form.addEventListener("dragover", (event) => {
    event.preventDefault();
    form.style.borderColor = "var(--blue)";
  });
  form.addEventListener("dragleave", () => form.style.borderColor = "");
  form.addEventListener("drop", (event) => {
    event.preventDefault();
    form.style.borderColor = "";
    uploadFile(event.dataTransfer.files[0]);
  });
  $$("[data-delete-file]").forEach((button) => button.addEventListener("click", async () => {
    await fetch(`/api/files/${button.dataset.deleteFile}`, { method: "DELETE" });
    const fresh = await fetch("/api/state");
    state = await fresh.json();
    render();
  }));
}

async function uploadFile(file) {
  if (!file) return;
  const body = new FormData();
  body.append("file", file);
  await fetch("/api/upload", { method: "POST", body });
  const res = await fetch("/api/state");
  state = await res.json();
  render();
}

function bindChapters() {
  $$("[data-subject]").forEach((button) => button.addEventListener("click", () => {
    activeSubject = button.dataset.subject;
    render();
  }));
  $$("[data-chapter-step]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.chapterStep;
    const step = Number(button.dataset.step);
    commit((s) => {
      const ch = s.chapters.find((item) => item.id === id);
      ch.topicsDone = Math.max(0, Math.min(ch.topicsTotal, ch.topicsDone + step));
    });
  }));
  $$("[data-delete-chapter]").forEach((button) => button.addEventListener("click", () => commit((s) => {
    s.chapters = s.chapters.filter((item) => item.id !== button.dataset.deleteChapter);
  })));
  $("#chapterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s.chapters.push({
      id: crypto.randomUUID(),
      subject: activeSubject,
      name: data.name,
      topicsTotal: Number(data.topicsTotal),
      topicsDone: 0
    }));
  });
}

function bindPlanner() {
  $("#objectiveForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = new FormData(event.target).get("text").trim();
    if (!text) return;
    commit((s) => s.objectives.unshift({ id: crypto.randomUUID(), date: todayIso(), text, done: false }));
  });
  $("#planForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s.plans.unshift({ id: crypto.randomUUID(), date: todayIso(), title: data.title, subject: data.subject, done: false }));
  });
  $$("[data-toggle-plan]").forEach((box) => box.addEventListener("change", () => commit((s) => {
    const item = s.plans.find((p) => p.id === box.dataset.togglePlan);
    item.done = box.checked;
  })));
  $$("[data-toggle-objective]").forEach((box) => box.addEventListener("change", () => commit((s) => {
    const item = s.objectives.find((p) => p.id === box.dataset.toggleObjective);
    item.done = box.checked;
  })));
  $$("[data-delete-plan]").forEach((button) => button.addEventListener("click", () => commit((s) => {
    s.plans = s.plans.filter((p) => p.id !== button.dataset.deletePlan);
  })));
  $$("[data-delete-objective]").forEach((button) => button.addEventListener("click", () => commit((s) => {
    s.objectives = s.objectives.filter((p) => p.id !== button.dataset.deleteObjective);
  })));
}

function bindTimers() {
  $("#flightForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const airportList = allAirports();
    const from = airportList.find((a) => a.code === data.from);
    const to = airportList.find((a) => a.code === data.to);
    const result = flightDuration(from, to);
    timer = { total: result.seconds, remaining: result.seconds, running: false, startedAt: 0 };
    $("#flightInfo").textContent = `${from.code} to ${to.code}: ${Math.round(result.km).toLocaleString()} km, estimated ${formatTimer(result.seconds)} study block.`;
    updateTimerFace();
  });
  $("#airportForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const code = data.code.trim().toUpperCase();
    const city = data.city.trim();
    const lat = Number(data.lat);
    const lon = Number(data.lon);
    if (!code || !city || Number.isNaN(lat) || Number.isNaN(lon)) return;
    commit((s) => {
      s.settings.customAirports = (s.settings.customAirports || []).filter((a) => a.code !== code);
      s.settings.customAirports.push({ code, city, country: "Custom", lat, lon });
    });
  });
  $("#manualTimerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const minutes = Number(new FormData(event.target).get("minutes"));
    timer = { total: minutes * 60, remaining: minutes * 60, running: false, startedAt: 0 };
    updateTimerFace();
  });
  $("[data-timer-start]")?.addEventListener("click", startTimer);
  $("[data-timer-pause]")?.addEventListener("click", pauseTimer);
  $("[data-timer-reset]")?.addEventListener("click", () => {
    pauseTimer();
    timer.remaining = timer.total;
    updateTimerFace();
  });
  $("[data-log-session]")?.addEventListener("click", () => {
    const completed = Math.max(1, Math.round((timer.total - timer.remaining) / 60));
    commit((s) => s.stats.sessions.push({ id: crypto.randomUUID(), date: todayIso(), subject: "Mixed", minutes: completed }));
  });
  $$("[data-audio]").forEach((button) => button.addEventListener("click", () => startAudio(button.dataset.audio)));
  $("[data-audio-stop]")?.addEventListener("click", stopAudio);
}

function bindStats() {
  $$("[data-stats-tab]").forEach((button) => button.addEventListener("click", () => {
    statsTab = button.dataset.statsTab;
    render();
  }));
  $("#mockForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s.stats.mocks.push({ id: crypto.randomUUID(), ...data, marks: Number(data.marks), notes: "" }));
  });
  $("#questionForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s.stats.questions.push({ id: crypto.randomUUID(), ...data, count: Number(data.count), correct: "" }));
  });
  $("#errorForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s.stats.errors.unshift({ id: crypto.randomUUID(), date: todayIso(), type: "Tracked", fixed: false, ...data }));
  });
  $$("[data-toggle-error]").forEach((box) => box.addEventListener("change", () => commit((s) => {
    const item = s.stats.errors.find((e) => e.id === box.dataset.toggleError);
    item.fixed = box.checked;
  })));
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timer.startedAt = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
    timer.remaining = Math.max(0, timer.remaining - elapsed);
    timer.startedAt = Date.now();
    updateTimerFace();
    if (timer.remaining <= 0) pauseTimer();
  }, 1000);
  updateTimerFace();
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timerInterval);
  updateTimerFace();
}

function updateTimerFace() {
  const display = $("#timerDisplay");
  const sub = $("#timerSub");
  if (!display) return;
  display.textContent = formatTimer(timer.remaining);
  if (sub) sub.textContent = timer.running ? "Wheels up. Stay with it." : "Paused or ready.";
}

function startAudio(mode) {
  stopAudio(false);
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audio.ctx = new AudioContext();
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.14;
  gain.connect(audio.ctx.destination);

  if (mode === "focus") {
    [174, 261.63, 329.63].forEach((freq, i) => {
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = i === 0 ? 0.08 : 0.035;
      osc.connect(g).connect(gain);
      osc.start();
      audio.nodes.push(osc, g);
    });
  } else {
    const bufferSize = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      if (mode === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else if (mode === "rain") {
        data[i] = white * (i % 170 < 6 ? 0.9 : 0.18);
      } else {
        data[i] = white;
      }
    }
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    audio.nodes.push(source);
  }
  audio.nodes.push(gain);
  audio.mode = mode;
  render();
}

function stopAudio(rerender = true) {
  audio.nodes.forEach((node) => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch {}
  });
  if (audio.ctx) audio.ctx.close();
  audio = { ctx: null, nodes: [], mode: null };
  if (rerender) render();
}

function drawCharts() {
  drawLineChart("marksChart", state.stats.mocks.map((m) => ({ label: m.date.slice(5), value: Number(m.marks || 0) })), 300, "Marks");
  const days = lastNDays(14).map((date) => {
    const minutes = state.stats.sessions.filter((s) => s.date === date).reduce((sum, s) => sum + Number(s.minutes || 0), 0);
    return { label: date.slice(5), value: Math.round(minutes / 60 * 10) / 10 };
  });
  drawLineChart("hoursChart", days, Math.max(8, ...days.map((d) => d.value)), "Hours");
}

function drawLineChart(id, points, maxValue, label) {
  const canvas = document.getElementById(id);
  if (!canvas || !points.length) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = getCss("--line");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(44, 20);
  ctx.lineTo(44, height - 38);
  ctx.lineTo(width - 16, height - 38);
  ctx.stroke();
  ctx.strokeStyle = getCss("--blue");
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = 44 + (i * (width - 72)) / Math.max(1, points.length - 1);
    const y = height - 38 - (Number(p.value) / maxValue) * (height - 64);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = getCss("--text");
  ctx.font = "700 13px sans-serif";
  ctx.fillText(label, 48, 18);
  points.forEach((p, i) => {
    const x = 44 + (i * (width - 72)) / Math.max(1, points.length - 1);
    const y = height - 38 - (Number(p.value) / maxValue) * (height - 64);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (i % Math.ceil(points.length / 6) === 0) {
      ctx.fillStyle = getCss("--muted");
      ctx.font = "11px sans-serif";
      ctx.fillText(p.label, x - 13, height - 12);
      ctx.fillStyle = getCss("--text");
    }
  });
}

function updateCountdowns() {
  $$("[data-countdown]").forEach((card) => {
    const date = new Date(`${card.dataset.countdown}T00:00:00`);
    const diff = date - new Date();
    const days = Math.ceil(diff / 86400000);
    $(".days", card).textContent = days > 0 ? `${days} days` : "Done";
  });
}

function getTotals() {
  const done = state.chapters.reduce((sum, c) => sum + c.topicsDone, 0);
  const total = state.chapters.reduce((sum, c) => sum + c.topicsTotal, 0);
  const week = new Set(lastNDays(7));
  return {
    chapterPercent: Math.round((done / Math.max(1, total)) * 100),
    questions: state.stats.questions.reduce((sum, q) => sum + Number(q.count || 0), 0),
    weekMinutes: state.stats.sessions.filter((s) => week.has(s.date)).reduce((sum, s) => sum + Number(s.minutes || 0), 0)
  };
}

function flightDuration(from, to) {
  const km = haversine(from.lat, from.lon, to.lat, to.lon);
  const seconds = Math.round(Math.max(30, (km / 840) * 60 + 35) * 60);
  return { km, seconds };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (n) => n * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatTimer(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function modeLabel(mode) {
  return { white: "White Noise", brown: "Brown Noise", rain: "Rain Cabin", focus: "Focus Pad" }[mode];
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / 1024 / 1024 * 10) / 10} MB`;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "2-digit", year: "numeric" });
}

function lastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getCss(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

boot();
