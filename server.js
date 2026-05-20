const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), "studypilot-data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const STATES_DIR = path.join(DATA_DIR, "users");
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "studypilot_session";
const SESSION_SECRET = process.env.APP_SESSION_SECRET || "local-dev-change-me";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function ensureStore() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(STATES_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload, headers = {}) {
  send(res, status, JSON.stringify(payload), { "Content-Type": "application/json; charset=utf-8", ...headers });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readUsers() {
  ensureStore();
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeUsers(users) {
  ensureStore();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-z0-9_.-]{3,32}$/.test(value);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sign(payload) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function createSession(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + SESSION_MAX_AGE * 1000
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function currentUser(req) {
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

function sessionCookie(req, username) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(createSession(username))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

function clearCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function defaultState(username) {
  return {
    settings: { name: username, darkMode: false },
    chapters: [],
    formulas: [],
    schedule: [],
    exams: [],
    notes: [],
    stats: { sessions: [], questions: [], mocks: [], errors: [] }
  };
}

function statePath(username) {
  return path.join(STATES_DIR, `${username}.json`);
}

function readState(username) {
  ensureStore();
  const file = statePath(username);
  if (!fs.existsSync(file)) return defaultState(username);
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  const base = defaultState(username);
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
    stats: { ...base.stats, ...(saved.stats || {}) }
  };
}

function writeState(username, state) {
  ensureStore();
  fs.writeFileSync(statePath(username), JSON.stringify(state, null, 2));
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
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const clean = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, clean));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, "Not found");
  send(res, 200, fs.readFileSync(filePath), { "Content-Type": mimeFor(filePath) });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/me") {
    const username = currentUser(req);
    return sendJson(res, 200, username ? { authenticated: true, username } : { authenticated: false });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await parseBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    if (!validUsername(username)) return sendJson(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
    const users = readUsers();
    if (users.some((user) => user.username === username)) return sendJson(res, 409, { error: "Username already exists." });
    const salt = crypto.randomBytes(16).toString("hex");
    users.push({ username, salt, passwordHash: hashPassword(password, salt), createdAt: new Date().toISOString() });
    writeUsers(users);
    writeState(username, defaultState(username));
    return sendJson(res, 201, { authenticated: true, username }, { "Set-Cookie": sessionCookie(req, username) });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await parseBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const user = readUsers().find((item) => item.username === username);
    if (!user || !safeEqual(hashPassword(password, user.salt), user.passwordHash)) {
      return sendJson(res, 401, { error: "Invalid username or password." });
    }
    return sendJson(res, 200, { authenticated: true, username }, { "Set-Cookie": sessionCookie(req, username) });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    return sendJson(res, 200, { authenticated: false }, { "Set-Cookie": clearCookie() });
  }

  const username = currentUser(req);
  if (!username) return sendJson(res, 401, { error: "Authentication required" });

  if (req.method === "GET" && url.pathname === "/api/state") {
    return sendJson(res, 200, readState(username));
  }

  if (req.method === "POST" && url.pathname === "/api/state") {
    const body = await parseBody(req);
    writeState(username, body);
    return sendJson(res, 200, readState(username));
  }

  return sendJson(res, 404, { error: "Unknown API route" });
}

ensureStore();

http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch((error) => sendJson(res, 500, { error: error.message }));
  } else {
    serveStatic(req, res);
  }
}).listen(PORT, () => {
  console.log(`Studypilot running at http://localhost:${PORT}`);
});
