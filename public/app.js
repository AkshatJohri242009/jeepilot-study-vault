const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const subjects = ["Physics", "Chemistry", "Math"];
const airports = [
  ["DEL", "Delhi", "India", 28.5562, 77.1],
  ["BOM", "Mumbai", "India", 19.0896, 72.8656],
  ["BLR", "Bengaluru", "India", 13.1986, 77.7066],
  ["MAA", "Chennai", "India", 12.9941, 80.1709],
  ["HYD", "Hyderabad", "India", 17.2403, 78.4294],
  ["DXB", "Dubai", "UAE", 25.2532, 55.3657],
  ["LHR", "London Heathrow", "UK", 51.47, -0.4543],
  ["JFK", "New York JFK", "USA", 40.6413, -73.7781],
  ["SIN", "Singapore", "Singapore", 1.3644, 103.9915]
].map(([code, city, country, lat, lon]) => ({ code, city, country, lat, lon }));

let state = null;
let currentUser = null;
let authMode = "login";
let activeView = "dashboard";
let activeSubject = "Physics";
let timer = { total: 45 * 60, remaining: 45 * 60, running: false };
let timerInterval = null;
let saveTimer = null;
let audio = { ctx: null, nodes: [] };

const navItems = [
  ["dashboard", "Dashboard"],
  ["chapters", "Chapters"],
  ["formulas", "Formula Sheets"],
  ["schedule", "Schedule"],
  ["exams", "Exams"],
  ["notes", "Notes"],
  ["stats", "Stats"],
  ["timers", "Timers"]
];

async function boot() {
  const me = await fetch("/api/me");
  const profile = await me.json();
  if (!profile.authenticated) {
    renderAuth();
    return;
  }
  currentUser = profile.username;
  await loadState();
  render();
}

async function loadState() {
  const res = await fetch("/api/state");
  if (res.status === 401) {
    currentUser = null;
    state = null;
    renderAuth();
    return;
  }
  state = normalizeState(await res.json());
  document.body.classList.toggle("dark", !!state.settings.darkMode);
}

function normalizeState(next) {
  return {
    settings: { name: currentUser || "pilot", darkMode: false, ...(next.settings || {}) },
    chapters: next.chapters || [],
    formulas: next.formulas || [],
    schedule: next.schedule || next.plans || [],
    exams: next.exams || [],
    notes: next.notes || [],
    stats: {
      sessions: next.stats?.sessions || [],
      questions: next.stats?.questions || [],
      mocks: next.stats?.mocks || [],
      errors: next.stats?.errors || []
    }
  };
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
  }, 250);
}

function commit(mutator) {
  mutator(state);
  persist();
  render();
}

function renderAuth(message = "") {
  document.body.classList.remove("nav-open");
  $("#app").innerHTML = `
    <main class="auth-shell">
      <canvas class="particle-canvas" data-particles></canvas>
      <section class="auth-card">
        <div>
          <span class="eyebrow">Student OS</span>
          <h1>${authMode === "login" ? "Sign in" : "Create account"}</h1>
          <p class="muted">A private study workspace with schedules, formulas, notes, exams, and progress tracking.</p>
        </div>
        <form id="authForm" class="field">
          <label>Username</label>
          <input name="username" autocomplete="username" placeholder="your_username" required>
          <label>Password</label>
          <input name="password" type="password" autocomplete="${authMode === "login" ? "current-password" : "new-password"}" placeholder="8+ characters" required>
          ${message ? `<p class="auth-message">${escapeHtml(message)}</p>` : ""}
          <button class="btn primary" type="submit">${authMode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button class="ghost-link" data-auth-toggle>${authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
      </section>
    </main>
  `;
  bindAuth();
  requestAnimationFrame(initParticles);
}

function bindAuth() {
  $("[data-auth-toggle]").addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    renderAuth();
  });
  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target));
    const res = await fetch(`/api/${authMode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      renderAuth(data.error || "Could not sign in.");
      return;
    }
    currentUser = data.username;
    await loadState();
    activeView = "dashboard";
    render();
  });
}

function render() {
  $("#app").innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="content">
        <div class="topbar">
          <button class="btn mobile-menu" data-mobile-menu>Menu</button>
          <span class="eyebrow">${todayIso()} / ${escapeHtml(currentUser)}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" data-dark>${state.settings.darkMode ? "Light" : "Dark"} mode</button>
          </div>
        </div>
        ${views[activeView]()}
      </main>
    </div>
  `;
  bindGlobal();
  if (activeView === "dashboard") requestAnimationFrame(initParticles);
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">SP</div>
        <div>
          <strong>Studypilot</strong>
          <div class="small">Student OS</div>
        </div>
      </div>
      <nav class="nav">
        ${navItems.map(([id, label]) => `<button class="${activeView === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}
      </nav>
      <div class="account">
        <span class="eyebrow">Signed in</span>
        <strong>${escapeHtml(currentUser)}</strong>
        <div style="margin-top:12px"><button class="btn" data-logout>Log out</button></div>
      </div>
    </aside>
  `;
}

const views = {
  dashboard() {
    const totals = getTotals();
    return `
      <section class="hero">
        <canvas class="particle-canvas" data-particles></canvas>
        <div class="hero-content">
          <span class="eyebrow">Command center</span>
          <h1>Welcome back,<br>${escapeHtml(currentUser)}.</h1>
          <p class="muted">Click any card to jump into the panel that controls it.</p>
        </div>
      </section>
      <section class="grid four" style="margin-top:16px">
        <button class="stat-card" data-jump="chapters"><span>Syllabus</span><strong>${totals.chapterPercent}%</strong></button>
        <button class="stat-card" data-jump="schedule"><span>Today's tasks</span><strong>${totals.todayTasks}</strong></button>
        <button class="stat-card" data-jump="stats"><span>Current streak</span><strong>${totals.streak}</strong></button>
        <button class="stat-card" data-jump="exams"><span>Upcoming exams</span><strong>${state.exams.length}</strong></button>
      </section>
      <section class="grid two" style="margin-top:16px">
        <div class="panel">
          <h2>Subject breakdown</h2>
          ${renderSubjectBreakdown()}
        </div>
        <div class="panel">
          <h2>Upcoming exams</h2>
          ${renderDashboardExams()}
        </div>
        <div class="panel">
          <h2>Study activity</h2>
          ${renderHeatmap()}
        </div>
        <div class="panel">
          <h2>Quick schedule</h2>
          ${renderScheduleList(true)}
        </div>
      </section>
    `;
  },
  chapters() {
    return page("Chapters", "Track subject-wise chapter completion.", `
      <form id="chapterForm" class="panel form-grid">
        <div class="field"><label>Chapter</label><input name="name" placeholder="Kinematics" required></div>
        <div class="field"><label>Subject</label><select name="subject">${subjectOptions()}</select></div>
        <div class="field"><label>Total topics</label><input name="total" type="number" min="1" value="10"></div>
        <button class="btn primary" type="submit">Add chapter</button>
      </form>
      <div class="tabs">${subjects.map((s) => `<button class="${activeSubject === s ? "active" : ""}" data-subject="${s}">${s}</button>`).join("")}</div>
      <div class="grid two">${state.chapters.filter((c) => c.subject === activeSubject).map(renderChapter).join("") || empty("No chapters yet.")}</div>
    `);
  },
  formulas() {
    return page("Formula Sheets", "Save fast-reference formula sheets by subject.", `
      <form id="formulaForm" class="panel form-grid">
        <div class="field"><label>Title</label><input name="title" placeholder="Ray optics formulas" required></div>
        <div class="field"><label>Subject</label><select name="subject">${subjectOptions()}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Formula sheet</label><textarea name="content" placeholder="Paste formulas, shortcuts, exceptions..." required></textarea></div>
        <button class="btn primary" type="submit">Save sheet</button>
      </form>
      <div class="grid two">${state.formulas.map(renderFormula).join("") || empty("No formula sheets yet.")}</div>
    `);
  },
  schedule() {
    return page("Schedule", "Plan classes, study blocks, revision, and breaks.", `
      <form id="scheduleForm" class="panel form-grid">
        <div class="field"><label>Task</label><input name="title" placeholder="Revise electrostatics" required></div>
        <div class="field"><label>Date</label><input name="date" type="date" value="${todayIso()}" required></div>
        <div class="field"><label>Time</label><input name="time" type="time"></div>
        <div class="field"><label>Subject</label><select name="subject">${subjectOptions()}<option>General</option></select></div>
        <div class="field" style="grid-column:1/-1"><label>Remark</label><input name="remark" placeholder="Goal, resource, or constraint"></div>
        <button class="btn primary" type="submit">Add task</button>
      </form>
      ${renderScheduleList(false)}
    `);
  },
  exams() {
    return page("Exam Scheduler", "Add, edit, or remove upcoming exam dates.", `
      <form id="examForm" class="panel form-grid">
        <div class="field"><label>Exam</label><input name="name" placeholder="JEE Main Attempt 1" required></div>
        <div class="field"><label>Date</label><input name="date" type="date" required></div>
        <div class="field"><label>Type</label><input name="type" placeholder="Mock / Main / Advanced"></div>
        <div class="field"><label>Target marks</label><input name="target" type="number" min="0" placeholder="250"></div>
        <button class="btn primary" type="submit">Add exam</button>
      </form>
      <div class="grid two">${state.exams.map(renderExam).join("") || empty("No exams scheduled.")}</div>
    `);
  },
  notes() {
    return page("Notes", "A lightweight editor for study notes and revision logs.", `
      <form id="noteForm" class="panel form-grid">
        <div class="field"><label>Title</label><input name="title" placeholder="Limits revision notes" required></div>
        <div class="field"><label>Subject</label><select name="subject">${subjectOptions()}<option>General</option></select></div>
        <div class="field" style="grid-column:1/-1"><label>Note</label><textarea name="content" placeholder="Write your notes here..." required></textarea></div>
        <button class="btn primary" type="submit">Save note</button>
      </form>
      <div class="grid two">${state.notes.map(renderNote).join("") || empty("No notes yet.")}</div>
    `);
  },
  stats() {
    return page("Stats", "Log questions, mock results, errors, and study sessions.", `
      <section class="grid three">
        <div class="stat-card"><span>Questions</span><strong>${sum(state.stats.questions, "count")}</strong></div>
        <div class="stat-card"><span>Mocks</span><strong>${state.stats.mocks.length}</strong></div>
        <div class="stat-card"><span>Open errors</span><strong>${state.stats.errors.filter((e) => !e.fixed).length}</strong></div>
      </section>
      <section class="grid three" style="margin-top:16px">
        ${statsForms()}
      </section>
      <section class="grid two" style="margin-top:16px">
        <div class="panel"><h2>Recent mocks</h2>${state.stats.mocks.map((m) => `<p><strong>${escapeHtml(m.exam)}</strong> - ${m.marks} marks<br><span class="muted">${escapeHtml(m.remark || "")}</span></p>`).join("") || empty("No mocks logged.")}</div>
        <div class="panel"><h2>Error tracker</h2>${state.stats.errors.map((e) => `<p><strong>${escapeHtml(e.subject)}</strong> / ${escapeHtml(e.chapter)}<br>${escapeHtml(e.note)}<br><span class="muted">${escapeHtml(e.remark || "")}</span></p>`).join("") || empty("No errors tracked.")}</div>
      </section>
    `);
  },
  timers() {
    const airportOptions = airports.map((a) => `<option value="${a.code}">${a.code} - ${a.city}</option>`).join("");
    return page("Timers", "Manual focus timer, flight timer, and browser-generated focus audio.", `
      <section class="grid two">
        <div class="panel">
          <div class="timer-face" id="timerDisplay">${formatTimer(timer.remaining)}</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">
            <button class="btn primary" data-timer-start>Start</button>
            <button class="btn" data-timer-pause>Pause</button>
            <button class="btn" data-timer-reset>Reset</button>
            <button class="btn" data-log-session>Log session</button>
          </div>
          <form id="manualTimerForm" class="form-grid" style="margin-top:16px">
            <div class="field"><label>Minutes</label><input name="minutes" type="number" min="1" value="45"></div>
            <button class="btn primary" type="submit">Load</button>
          </form>
        </div>
        <div class="panel">
          <h2>Flight timer</h2>
          <form id="flightForm" class="form-grid">
            <div class="field"><label>From</label><select name="from">${airportOptions}</select></div>
            <div class="field"><label>To</label><select name="to">${airportOptions}</select></div>
            <button class="btn primary" type="submit">Load flight</button>
          </form>
          <p class="muted" id="flightInfo"></p>
          <h2>Focus audio</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" data-audio="white">White noise</button>
            <button class="btn" data-audio="rain">Rain</button>
            <button class="btn" data-audio="focus">Focus pad</button>
            <button class="btn danger" data-audio-stop>Stop</button>
          </div>
        </div>
      </section>
    `);
  }
};

function page(title, copy, body) {
  return `<section class="page-title"><span class="eyebrow">Studypilot</span><h1>${title}</h1><p>${copy}</p></section>${body}`;
}

function bindGlobal() {
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => {
    activeView = button.dataset.view;
    document.body.classList.remove("nav-open");
    render();
  }));
  $$("[data-jump]").forEach((button) => button.addEventListener("click", () => {
    activeView = button.dataset.jump;
    render();
  }));
  $("[data-mobile-menu]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    document.body.classList.add("nav-open");
  });
  $(".content")?.addEventListener("click", () => document.body.classList.remove("nav-open"));
  $("[data-dark]")?.addEventListener("click", () => commit((s) => {
    s.settings.darkMode = !s.settings.darkMode;
    document.body.classList.toggle("dark", s.settings.darkMode);
  }));
  $("[data-logout]")?.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    stopAudio();
    state = null;
    currentUser = null;
    authMode = "login";
    renderAuth();
  });
  bindForms();
}

function bindForms() {
  $("#chapterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s.chapters.push({ id: uid(), name: data.name, subject: data.subject, done: 0, total: Number(data.total || 10) }));
  });
  $$("[data-subject]").forEach((button) => button.addEventListener("click", () => {
    activeSubject = button.dataset.subject;
    render();
  }));
  $$("[data-chapter-step]").forEach((button) => button.addEventListener("click", () => commit((s) => {
    const ch = s.chapters.find((item) => item.id === button.dataset.chapterStep);
    ch.done = Math.max(0, Math.min(ch.total, ch.done + Number(button.dataset.step)));
  })));
  $$("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteItem(button.dataset.delete, button.dataset.id)));
  $("#formulaForm")?.addEventListener("submit", submitTo("formulas", (data) => ({ id: uid(), ...data, updatedAt: new Date().toISOString() })));
  $("#scheduleForm")?.addEventListener("submit", submitTo("schedule", (data) => ({ id: uid(), done: false, ...data })));
  $("#examForm")?.addEventListener("submit", submitTo("exams", (data) => ({ id: uid(), ...data })));
  $("#noteForm")?.addEventListener("submit", submitTo("notes", (data) => ({ id: uid(), ...data, updatedAt: new Date().toISOString() })));
  $$("[data-toggle-task]").forEach((box) => box.addEventListener("change", () => commit((s) => {
    const item = s.schedule.find((task) => task.id === box.dataset.toggleTask);
    item.done = box.checked;
  })));
  $$("[data-exam-field]").forEach((input) => input.addEventListener("change", () => commit((s) => {
    const exam = s.exams.find((item) => item.id === input.dataset.id);
    exam[input.dataset.examField] = input.value;
  })));
  $("#questionForm")?.addEventListener("submit", submitStat("questions", (data) => ({ id: uid(), date: todayIso(), ...data, count: Number(data.count || 0) })));
  $("#mockForm")?.addEventListener("submit", submitStat("mocks", (data) => ({ id: uid(), date: data.date || todayIso(), ...data, marks: Number(data.marks || 0) })));
  $("#errorForm")?.addEventListener("submit", submitStat("errors", (data) => ({ id: uid(), date: todayIso(), fixed: false, ...data })));
  bindTimerForms();
}

function submitTo(collection, mapper) {
  return (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s[collection].unshift(mapper(data)));
  };
}

function submitStat(collection, mapper) {
  return (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    commit((s) => s.stats[collection].unshift(mapper(data)));
  };
}

function deleteItem(collection, id) {
  commit((s) => {
    s[collection] = s[collection].filter((item) => item.id !== id);
  });
}

function bindTimerForms() {
  $("#manualTimerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const minutes = Number(new FormData(event.target).get("minutes"));
    timer.total = minutes * 60;
    timer.remaining = timer.total;
    timer.running = false;
    updateTimer();
  });
  $("#flightForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const from = airports.find((a) => a.code === data.from);
    const to = airports.find((a) => a.code === data.to);
    const km = haversine(from.lat, from.lon, to.lat, to.lon);
    const minutes = Math.round(Math.max(30, (km / 840) * 60 + 35));
    timer.total = minutes * 60;
    timer.remaining = timer.total;
    $("#flightInfo").textContent = `${from.code} to ${to.code}: ${Math.round(km)} km, ${minutes} minutes.`;
    updateTimer();
  });
  $("[data-timer-start]")?.addEventListener("click", startTimer);
  $("[data-timer-pause]")?.addEventListener("click", pauseTimer);
  $("[data-timer-reset]")?.addEventListener("click", () => {
    pauseTimer();
    timer.remaining = timer.total;
    updateTimer();
  });
  $("[data-log-session]")?.addEventListener("click", () => {
    const minutes = Math.max(1, Math.round((timer.total - timer.remaining) / 60));
    commit((s) => s.stats.sessions.push({ id: uid(), date: todayIso(), minutes }));
  });
  $$("[data-audio]").forEach((button) => button.addEventListener("click", () => startAudio(button.dataset.audio)));
  $("[data-audio-stop]")?.addEventListener("click", stopAudio);
}

function renderChapter(chapter) {
  const pct = Math.round((chapter.done / Math.max(1, chapter.total)) * 100);
  return `
    <article class="list-card">
      <header><div><strong>${escapeHtml(chapter.name)}</strong><br><span class="pill">${chapter.subject}</span></div><button class="btn danger" data-delete="chapters" data-id="${chapter.id}">Remove</button></header>
      <div class="progress" style="margin:14px 0"><span style="width:${pct}%"></span></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="muted">${chapter.done}/${chapter.total} topics / ${pct}%</span>
        <span><button class="btn" data-chapter-step="${chapter.id}" data-step="-1">-</button> <button class="btn" data-chapter-step="${chapter.id}" data-step="1">+</button></span>
      </div>
    </article>
  `;
}

function renderFormula(item) {
  return `
    <article class="list-card">
      <header><div><strong>${escapeHtml(item.title)}</strong><br><span class="pill">${item.subject}</span></div><button class="btn danger" data-delete="formulas" data-id="${item.id}">Remove</button></header>
      <pre style="white-space:pre-wrap;font-family:inherit;line-height:1.6">${escapeHtml(item.content)}</pre>
    </article>
  `;
}

function renderScheduleList(compact) {
  const items = [...state.schedule].sort((a, b) => `${a.date || ""}${a.time || ""}`.localeCompare(`${b.date || ""}${b.time || ""}`));
  const visible = compact ? items.slice(0, 5) : items;
  return `<div class="list">${visible.map((item) => `
    <article class="list-card">
      <header>
        <label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" ${item.done ? "checked" : ""} data-toggle-task="${item.id}"><span><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${item.date || ""} ${item.time || ""} / ${item.subject || "General"}</span><br><span class="muted">${escapeHtml(item.remark || "")}</span></span></label>
        <button class="btn danger" data-delete="schedule" data-id="${item.id}">Remove</button>
      </header>
    </article>`).join("") || empty("No schedule items yet.")}</div>`;
}

function renderExam(item) {
  return `
    <article class="list-card">
      <header><strong>${escapeHtml(item.name)}</strong><button class="btn danger" data-delete="exams" data-id="${item.id}">Remove</button></header>
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>Date</label><input type="date" value="${item.date || ""}" data-exam-field="date" data-id="${item.id}"></div>
        <div class="field"><label>Type</label><input value="${escapeHtml(item.type || "")}" data-exam-field="type" data-id="${item.id}"></div>
        <div class="field"><label>Target</label><input type="number" value="${item.target || ""}" data-exam-field="target" data-id="${item.id}"></div>
      </div>
      <p class="muted">${daysLeft(item.date)} days left</p>
    </article>
  `;
}

function renderDashboardExams() {
  return `<div class="list">${state.exams.slice(0, 4).map(renderExam).join("") || empty("No upcoming exams. Add one in Exams.")}</div>`;
}

function renderNote(item) {
  return `
    <article class="list-card">
      <header><div><strong>${escapeHtml(item.title)}</strong><br><span class="pill">${item.subject}</span></div><button class="btn danger" data-delete="notes" data-id="${item.id}">Remove</button></header>
      <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(item.content)}</p>
    </article>
  `;
}

function renderSubjectBreakdown() {
  return subjects.map((subject) => {
    const chapters = state.chapters.filter((item) => item.subject === subject);
    const done = chapters.reduce((total, item) => total + item.done, 0);
    const all = chapters.reduce((total, item) => total + item.total, 0);
    const pct = Math.round((done / Math.max(1, all)) * 100);
    return `<div style="margin:14px 0"><strong>${subject}</strong><div class="progress" style="margin:8px 0"><span style="width:${pct}%"></span></div><span class="muted">${pct}% complete</span></div>`;
  }).join("");
}

function renderHeatmap() {
  const byDate = new Map();
  state.stats.sessions.forEach((s) => byDate.set(s.date, (byDate.get(s.date) || 0) + Number(s.minutes || 0)));
  const cells = [];
  const now = new Date();
  for (let i = 90; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const minutes = byDate.get(key) || 0;
    const level = minutes === 0 ? 0 : minutes < 45 ? 1 : minutes < 90 ? 2 : minutes < 150 ? 3 : 4;
    cells.push(`<div class="heat-cell level-${level}" title="${key}: ${minutes} min"></div>`);
  }
  return `<div class="heatmap">${cells.join("")}</div>`;
}

function statsForms() {
  return `
    <form id="questionForm" class="panel field"><h2>Questions</h2><label>Subject</label><select name="subject">${subjectOptions()}</select><label>Count</label><input name="count" type="number" min="1" required><label>Remark</label><input name="remark" placeholder="PYQ, module, weak area"><button class="btn primary">Log</button></form>
    <form id="mockForm" class="panel field"><h2>Mock</h2><label>Exam</label><input name="exam" required><label>Date</label><input name="date" type="date" value="${todayIso()}"><label>Marks</label><input name="marks" type="number" min="0" max="300"><label>Remark</label><input name="remark" placeholder="What to fix next"><button class="btn primary">Log</button></form>
    <form id="errorForm" class="panel field"><h2>Error</h2><label>Subject</label><select name="subject">${subjectOptions()}</select><label>Chapter</label><input name="chapter" required><label>Error</label><input name="note" required><label>Remark</label><input name="remark" placeholder="Prevention rule"><button class="btn primary">Track</button></form>
  `;
}

function getTotals() {
  const done = state.chapters.reduce((total, item) => total + item.done, 0);
  const all = state.chapters.reduce((total, item) => total + item.total, 0);
  return {
    chapterPercent: Math.round((done / Math.max(1, all)) * 100),
    todayTasks: state.schedule.filter((item) => item.date === todayIso()).length,
    streak: getStreak()
  };
}

function getStreak() {
  const active = new Set(state.stats.sessions.filter((s) => Number(s.minutes) > 0).map((s) => s.date));
  let streak = 0;
  const date = new Date();
  while (active.has(date.toISOString().slice(0, 10))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function initParticles() {
  $$("[data-particles]").forEach((canvas) => {
    if (canvas.dataset.ready) return;
    canvas.dataset.ready = "true";
    const parent = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const pointer = { x: 0.5, y: 0.5, active: false };
    const particles = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, z: Math.random() }));
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    parent.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width;
      pointer.y = (event.clientY - rect.top) / rect.height;
      pointer.active = true;
    });
    parent.addEventListener("pointerleave", () => pointer.active = false);
    window.addEventListener("resize", resize);
    resize();
    const draw = () => {
      if (!canvas.isConnected) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p, i) => {
        const targetX = pointer.active ? pointer.x : 0.5 + Math.cos(performance.now() * 0.0004) * 0.12;
        const targetY = pointer.active ? pointer.y : 0.5 + Math.sin(performance.now() * 0.0004) * 0.12;
        p.vx += (targetX - p.x) * 0.0007 + Math.sin(i + performance.now() * 0.001) * 0.00008;
        p.vy += (targetY - p.y) * 0.0007 + Math.cos(i + performance.now() * 0.001) * 0.00008;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
      });
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        const ax = a.x * width;
        const ay = a.y * height;
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const bx = b.x * width;
          const by = b.y * height;
          const d = Math.hypot(ax - bx, ay - by);
          if (d < 110) {
            ctx.strokeStyle = `rgba(37,99,235,${0.22 * (1 - d / 110)})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(37,99,235,0.68)";
        ctx.beginPath();
        ctx.arc(ax, ay, 1.7 + a.z * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    draw();
  });
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timerInterval = setInterval(() => {
    timer.remaining = Math.max(0, timer.remaining - 1);
    updateTimer();
    if (timer.remaining === 0) pauseTimer();
  }, 1000);
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timerInterval);
}

function updateTimer() {
  const el = $("#timerDisplay");
  if (el) el.textContent = formatTimer(timer.remaining);
}

function startAudio(mode) {
  stopAudio();
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.18;
  gain.connect(audio.ctx.destination);
  if (mode === "focus") {
    [174, 261, 329].forEach((freq) => {
      const osc = audio.ctx.createOscillator();
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
      audio.nodes.push(osc);
    });
    return;
  }
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 2, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (mode === "rain" && i % 90 < 8 ? 1 : 0.35);
  const source = audio.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  source.start();
  audio.nodes.push(source);
}

function stopAudio() {
  audio.nodes.forEach((node) => {
    try { node.stop(); } catch {}
    try { node.disconnect(); } catch {}
  });
  if (audio.ctx) audio.ctx.close();
  audio = { ctx: null, nodes: [] };
}

function subjectOptions() {
  return subjects.map((s) => `<option>${s}</option>`).join("");
}

function empty(text) {
  return `<p class="muted">${text}</p>`;
}

function daysLeft(date) {
  if (!date) return "-";
  return Math.max(0, Math.ceil((new Date(`${date}T00:00:00`) - new Date()) / 86400000));
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
  return h ? [h, m, s].map((n) => String(n).padStart(2, "0")).join(":") : [m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return crypto.randomUUID();
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

boot();
