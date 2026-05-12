const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PORT = Number(process.env.PORT || 4173);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "study-files";
const SUPABASE_STATE_ID = process.env.SUPABASE_STATE_ID || "default";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const SESSION_COOKIE = "jeepilot_session";
const SESSION_SECRET = process.env.APP_SESSION_SECRET || "local-dev-change-me";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function freshDefaultDb(username = "pilot") {
  return {
    settings: {
    name: username,
    darkMode: false,
    sidebarCollapsed: false,
    customAirports: [],
    examDates: {
      main1: "2027-01-24",
      main2: "2027-04-02",
      advanced: "2027-05-24"
    }
    },
    chapters: [],
    plans: [],
    objectives: [],
    stats: {
      mocks: [],
      questions: [],
      errors: [],
      sessions: []
    },
    files: []
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ensureStore() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(freshDefaultDb(), null, 2));
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

function userStateId(username) {
  return `${SUPABASE_STATE_ID}:${username}`;
}

function localDbFile(username) {
  return path.join(DATA_DIR, "users", username, "db.json");
}

function localReadDb(username) {
  ensureStore();
  const file = localDbFile(username);
  if (!fs.existsSync(file)) {
    const initial = freshDefaultDb(username);
    localWriteDb(username, initial);
    return initial;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function localWriteDb(username, db) {
  const file = localDbFile(username);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

function mergeState(saved, username) {
  const base = freshDefaultDb(username);
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
    stats: { ...base.stats, ...(saved.stats || {}) },
    files: saved.files || []
  };
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

async function supabaseJson(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: supabaseHeaders(options.headers || {})
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return payload;
}

async function readDb(username) {
  if (!USE_SUPABASE) return localReadDb(username);
  const id = userStateId(username);
  const rows = await supabaseJson(`/rest/v1/study_states?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`);
  if (!rows.length) {
    const initial = freshDefaultDb(username);
    await writeDb(username, initial);
    return initial;
  }
  return mergeState(rows[0].payload || {}, username);
}

async function writeDb(username, db) {
  if (!USE_SUPABASE) return localWriteDb(username, db);
  await supabaseJson(`/rest/v1/study_states?on_conflict=id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([{ id: userStateId(username), payload: db }])
  });
}

async function uploadStoredFile(storedName, body, type) {
  if (!USE_SUPABASE) {
    const filePath = path.join(DATA_DIR, storedName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, body);
    return;
  }
  const storagePath = storedName.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`, {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": type,
      "cache-control": "3600"
    }),
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase storage upload failed: ${text || response.statusText}`);
  }
}

async function readStoredFile(storedName) {
  if (!USE_SUPABASE) {
    const filePath = path.join(DATA_DIR, storedName);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }
  const storagePath = storedName.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`, {
    headers: supabaseHeaders()
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Supabase storage download failed: ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

async function deleteStoredFile(storedName) {
  if (!USE_SUPABASE) {
    const filePath = path.join(DATA_DIR, storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}`, {
    method: "DELETE",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [storedName] })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase storage delete failed: ${text || response.statusText}`);
  }
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === "string" || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload);
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, payload, { "Content-Type": "application/json; charset=utf-8" });
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSession(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.username || Date.now() > data.exp) return null;
    return data.username;
  } catch {
    return null;
  }
}

function setSessionCookie(req, res, username) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(createSession(username))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validUsername(username) {
  return /^[a-z0-9_.-]{3,32}$/.test(username);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, salt, expected) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}

function localUsers() {
  ensureStore();
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function localWriteUsers(users) {
  ensureStore();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

async function findUser(username) {
  if (!USE_SUPABASE) return localUsers().find((user) => user.username === username) || null;
  const rows = await supabaseJson(`/rest/v1/study_users?username=eq.${encodeURIComponent(username)}&select=username,password_hash,salt&limit=1`);
  return rows[0] || null;
}

async function createUser(username, password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const password_hash = hashPassword(password, salt);
  if (!USE_SUPABASE) {
    const users = localUsers();
    if (users.some((user) => user.username === username)) throw new Error("Username already exists");
    users.push({ username, password_hash, salt, created_at: new Date().toISOString() });
    localWriteUsers(users);
    await writeDb(username, freshDefaultDb(username));
    return;
  }
  await supabaseJson("/rest/v1/study_users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify([{ username, password_hash, salt }])
  });
  await writeDb(username, freshDefaultDb(username));
}

async function requireUser(req, res) {
  const username = readSession(req);
  if (!username) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  return username;
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

  if (req.method === "GET" && url.pathname === "/api/me") {
    const username = readSession(req);
    if (!username) return sendJson(res, 200, { authenticated: false });
    return sendJson(res, 200, { authenticated: true, username });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await parseBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    if (!validUsername(username)) return sendJson(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
    if (await findUser(username)) return sendJson(res, 409, { error: "Username already exists." });
    await createUser(username, password);
    setSessionCookie(req, res, username);
    return sendJson(res, 201, { authenticated: true, username });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await parseBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const user = await findUser(username);
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      return sendJson(res, 401, { error: "Invalid username or password." });
    }
    setSessionCookie(req, res, username);
    return sendJson(res, 200, { authenticated: true, username });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    clearSessionCookie(res);
    return sendJson(res, 200, { authenticated: false });
  }

  const username = await requireUser(req, res);
  if (!username) return;
  const db = await readDb(username);

  if (req.method === "GET" && url.pathname === "/api/state") return sendJson(res, 200, db);

  if (req.method === "POST" && url.pathname === "/api/state") {
    const next = await parseBody(req);
    await writeDb(username, { ...db, ...next });
    return sendJson(res, 200, await readDb(username));
  }

  if (req.method === "POST" && url.pathname === "/api/upload") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const parts = parseMultipart(Buffer.concat(chunks), req.headers["content-type"] || "");
        const filePart = parts.find((part) => /name="file"/.test(part.headers));
        if (!filePart) return sendJson(res, 400, { error: "No file provided" });
        const filenameMatch = filePart.headers.match(/filename="([^"]+)"/);
        const originalName = safeName(filenameMatch ? filenameMatch[1] : "study-file.bin");
        const type = (filePart.headers.match(/Content-Type: ([^\r\n]+)/i) || [])[1] || "application/octet-stream";
        const storedName = `${username}/uploads/${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${originalName}`;
        await uploadStoredFile(storedName, filePart.body, type);
        const updated = await readDb(username);
        const record = {
          id: crypto.randomUUID(),
          name: originalName,
          storedName,
          size: filePart.body.length,
          type,
          uploadedAt: new Date().toISOString()
        };
        updated.files.unshift(record);
        await writeDb(username, updated);
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
    const bytes = await readStoredFile(file.storedName);
    if (!bytes) return send(res, 404, "Missing upload");
    return send(res, 200, bytes, {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name.replace(/"/g, "")}"`
    });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/files/")) {
    const id = url.pathname.split("/").pop();
    const file = db.files.find((item) => item.id === id);
    if (file) await deleteStoredFile(file.storedName);
    db.files = db.files.filter((item) => item.id !== id);
    await writeDb(username, db);
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
