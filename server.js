const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT || 4173);

const defaultDb = {
  settings: {
    name: "Admin",
    darkMode: false,
    sidebarCollapsed: false,
    customAirports: [],
    examDates: {
      main1: "2027-01-24",
      main2: "2027-04-02",
      advanced: "2027-05-24"
    }
  },
  chapters: [
    { id: "ph-kin", subject: "Physics", name: "Kinematics", topicsTotal: 5, topicsDone: 2 },
    { id: "ph-nlm", subject: "Physics", name: "Laws of Motion", topicsTotal: 6, topicsDone: 1 },
    { id: "ph-wep", subject: "Physics", name: "Work, Energy & Power", topicsTotal: 5, topicsDone: 0 },
    { id: "ch-atomic", subject: "Chemistry", name: "Atomic Structure", topicsTotal: 6, topicsDone: 2 },
    { id: "ch-bonding", subject: "Chemistry", name: "Chemical Bonding", topicsTotal: 8, topicsDone: 3 },
    { id: "ma-quad", subject: "Math", name: "Quadratic Equations", topicsTotal: 5, topicsDone: 4 },
    { id: "ma-seq", subject: "Math", name: "Sequences & Series", topicsTotal: 7, topicsDone: 2 }
  ],
  plans: [
    { id: "plan-1", date: todayIso(), title: "Revise Kinematics formulas", done: false, subject: "Physics" },
    { id: "plan-2", date: todayIso(), title: "30 PYQs from Chemical Bonding", done: false, subject: "Chemistry" }
  ],
  objectives: [
    { id: "obj-1", date: todayIso(), text: "Win the first 90 minutes: one hard topic before messages.", done: false }
  ],
  stats: {
    mocks: [
      { id: "mock-1", date: "2026-05-04", exam: "JEE Main Mock 01", marks: 166, physics: 52, chemistry: 58, math: 56, notes: "Lost marks in silly errors." },
      { id: "mock-2", date: "2026-05-10", exam: "JEE Main Mock 02", marks: 184, physics: 60, chemistry: 62, math: 62, notes: "Better pacing." }
    ],
    questions: [
      { id: "q-1", date: todayIso(), subject: "Physics", count: 25, correct: 19 },
      { id: "q-2", date: todayIso(), subject: "Math", count: 18, correct: 12 }
    ],
    errors: [
      { id: "err-1", date: todayIso(), subject: "Physics", chapter: "Kinematics", type: "Concept", note: "Relative velocity sign convention", fixed: false }
    ],
    sessions: seedSessions()
  },
  files: []
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function seedSessions() {
  const subjects = ["Physics", "Chemistry", "Math"];
  const rows = [];
  const now = new Date();
  for (let i = 88; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const active = i % 3 !== 0;
    rows.push({
      id: `session-${i}`,
      date: d.toISOString().slice(0, 10),
      subject: subjects[i % subjects.length],
      minutes: active ? 35 + ((i * 17) % 150) : 0
    });
  }
  return rows;
}

function ensureStore() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
  }
}

function readDb() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === "string" || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload);
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, payload, { "Content-Type": "application/json; charset=utf-8" });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      if (!raw.length) return resolve({});
      try {
        resolve(JSON.parse(raw.toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Missing multipart boundary");
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let start = buffer.indexOf(boundary) + boundary.length + 2;
  while (start > boundary.length) {
    const end = buffer.indexOf(boundary, start);
    if (end < 0) break;
    const part = buffer.subarray(start, end - 2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd > -1) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      const body = part.subarray(headerEnd + 4);
      parts.push({ headers, body });
    }
    start = end + boundary.length + 2;
  }
  return parts;
}

function safeName(name) {
  return name.replace(/[^\w.\-()[\] ]+/g, "_").slice(0, 160);
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, "Not found");
  send(res, 200, fs.readFileSync(filePath), { "Content-Type": mimeFor(filePath) });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

  if (req.method === "GET" && url.pathname === "/api/state") return sendJson(res, 200, db);

  if (req.method === "POST" && url.pathname === "/api/state") {
    const next = await parseBody(req);
    writeDb({ ...db, ...next });
    return sendJson(res, 200, readDb());
  }

  if (req.method === "POST" && url.pathname === "/api/upload") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const parts = parseMultipart(Buffer.concat(chunks), req.headers["content-type"] || "");
        const filePart = parts.find((part) => /name="file"/.test(part.headers));
        if (!filePart) return sendJson(res, 400, { error: "No file provided" });
        const filenameMatch = filePart.headers.match(/filename="([^"]+)"/);
        const originalName = safeName(filenameMatch ? filenameMatch[1] : "study-file.bin");
        const storedName = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${originalName}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, storedName), filePart.body);
        const updated = readDb();
        const record = {
          id: crypto.randomUUID(),
          name: originalName,
          storedName,
          size: filePart.body.length,
          type: (filePart.headers.match(/Content-Type: ([^\r\n]+)/i) || [])[1] || "application/octet-stream",
          uploadedAt: new Date().toISOString()
        };
        updated.files.unshift(record);
        writeDb(updated);
        sendJson(res, 201, record);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/files/")) {
    const id = url.pathname.split("/").pop();
    const file = db.files.find((item) => item.id === id);
    if (!file) return send(res, 404, "Not found");
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(filePath)) return send(res, 404, "Missing upload");
    return send(res, 200, fs.readFileSync(filePath), {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name.replace(/"/g, "")}"`
    });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/files/")) {
    const id = url.pathname.split("/").pop();
    const file = db.files.find((item) => item.id === id);
    if (file) {
      const filePath = path.join(UPLOAD_DIR, file.storedName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.files = db.files.filter((item) => item.id !== id);
    writeDb(db);
    return sendJson(res, 200, db.files);
  }

  sendJson(res, 404, { error: "Unknown API route" });
}

ensureStore();

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch((error) => sendJson(res, 500, { error: error.message }));
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`JEEPILOT Study Vault running at http://localhost:${PORT}`);
});
