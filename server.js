import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "data", "db.json");

const PORT = process.env.PORT || 5000;

// ─── In-Memory Rate Limiter ────────────────────────────────────────────────────
// Tracks failed login attempts per IP address
const loginAttempts = new Map(); // Map<ip, { count: number, resetAt: number }>
const RATE_LIMIT_MAX  = 5;          // max attempts
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60 seconds

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    // First attempt or window expired – reset
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { blocked: false, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    const waitSec = Math.ceil((record.resetAt - now) / 1000);
    return { blocked: true, waitSec };
  }

  record.count += 1;
  return { blocked: false, remaining: RATE_LIMIT_MAX - record.count };
}

function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}

// ─── Validation Helpers ────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function validateEmail(email) {
  if (!email || typeof email !== "string") return "Email wajib diisi.";
  const trimmed = email.trim();
  if (trimmed.length === 0) return "Email tidak boleh kosong.";
  if (trimmed.length > 254) return "Email terlalu panjang.";
  if (!EMAIL_REGEX.test(trimmed)) return "Format email tidak valid. Contoh: nama@email.com";
  return null; // valid
}

function validatePassword(password) {
  if (!password || typeof password !== "string") return "Password wajib diisi.";
  if (password.length < 8) return "Password minimal 8 karakter.";
  if (password.length > 128) return "Password terlalu panjang (maks 128 karakter).";
  if (!/[A-Z]/.test(password)) return "Password harus mengandung minimal satu huruf kapital (A-Z).";
  if (!/[0-9]/.test(password)) return "Password harus mengandung minimal satu angka (0-9).";
  if (/\s/.test(password)) return "Password tidak boleh mengandung spasi.";
  return null; // valid
}

function validateFullName(fullName) {
  if (!fullName || typeof fullName !== "string") return "Nama lengkap wajib diisi.";
  const trimmed = fullName.trim();
  if (trimmed.length < 2) return "Nama lengkap minimal 2 karakter.";
  if (trimmed.length > 80) return "Nama lengkap terlalu panjang (maks 80 karakter).";
  if (/[0-9]/.test(trimmed)) return "Nama lengkap tidak boleh mengandung angka.";
  if (/[^a-zA-Z\s\u00C0-\u024F\u1E00-\u1EFF'-]/.test(trimmed)) {
    return "Nama lengkap hanya boleh berisi huruf, spasi, tanda hubung, dan apostrof.";
  }
  return null; // valid
}

// ─── OpenRouter AI Engine Helper ──────────────────────────────────────────────
async function callOpenRouterAI({ model = "google/gemini-2.5-flash:free", systemPrompt, messages, apiKey }) {
  const effectiveKey = apiKey || process.env.OPENROUTER_API_KEY || "";

  if (effectiveKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${effectiveKey}`,
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "Mobile Finance Tracker App",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "google/gemini-2.5-flash:free",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return { success: true, provider: "openrouter", model, reply: content };
        }
      } else {
        const errText = await response.text();
        console.warn("[OpenRouter API Warning] Fallback triggered:", response.status, errText);
      }
    } catch (err) {
      console.warn("[OpenRouter API Error] Fallback triggered:", err.message);
    }
  }

  // Smart Local Fallback AI Engine if no key or API call fails
  return { success: true, provider: "local_engine", model: "smart-local-ai", reply: null };
}

// ─── DB Helpers ────────────────────────────────────────────────────────────────
const initialData = {
  users: [],
  transactions: [],
  budgets: [],
  schedules: [],
};

function ensureDbExists() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

function readDb() {
  ensureDbExists();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return { ...initialData };
  }
}

function writeDb(data) {
  ensureDbExists();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─── HTTP Helpers ──────────────────────────────────────────────────────────────
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id");
}

function sendJson(res, statusCode, body) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (err) { reject(err); }
    });
  });
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return (forwarded ? forwarded.split(",")[0] : req.socket.remoteAddress) || "unknown";
}

function getUserIdFromReq(req, urlParams) {
  return req.headers["x-user-id"] || urlParams.get("userId") || null;
}

// ─── Static File Serving for Full-Stack Deployment ───────────────────────────
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webapp": "application/x-web-app-manifest+json",
  ".webmanifest": "application/manifest+json",
};

function serveStatic(res, pathname) {
  const distDir = path.join(__dirname, "dist");
  if (!fs.existsSync(distDir)) return false;

  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) return false;

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // SPA Fallback: serve index.html for frontend routes
  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }

  return false;
}

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const clientIp = getClientIp(req);

  try {
    // ── Serve Static Assets & SPA Frontend for non-API routes ───────────────
    if (!pathname.startsWith("/api/") && !pathname.startsWith("/anichin-proxy")) {
      const served = serveStatic(res, pathname);
      if (served) return;
    }

    // ── Health Check ────────────────────────────────────────────────────────────
    if (pathname === "/api/v1/health" && req.method === "GET") {
      return sendJson(res, 200, {
        status: "ok",
        service: "Mobile Finance Tracker API",
        version: "2.1.0",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }

    // ── Auth Register ───────────────────────────────────────────────────────────
    if (pathname === "/api/v1/auth/register" && req.method === "POST") {
      const body = await parseBody(req);
      const { email, password, fullName } = body;

      // ── Field validations ────────────────────────────────────────────────────
      const fieldErrors = {};
      const emailErr    = validateEmail(email);
      const passwordErr = validatePassword(password);
      const nameErr     = validateFullName(fullName);

      if (emailErr)    fieldErrors.email    = emailErr;
      if (passwordErr) fieldErrors.password = passwordErr;
      if (nameErr)     fieldErrors.fullName = nameErr;

      if (Object.keys(fieldErrors).length > 0) {
        return sendJson(res, 400, {
          success: false,
          error: Object.values(fieldErrors)[0], // First error for modal display
          fieldErrors,
        });
      }

      // ── Duplicate email check ────────────────────────────────────────────────
      const db = readDb();
      const existing = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        return sendJson(res, 409, {
          success: false,
          error: "Email sudah terdaftar. Silakan gunakan email lain atau login.",
          fieldErrors: { email: "Email sudah terdaftar." },
        });
      }

      const newUser = {
        id: "u_" + Date.now(),
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        // NOTE: In production replace this with bcrypt hash
        password: password,
        currency: "IDR",
        createdAt: new Date().toISOString(),
        loginCount: 0,
      };

      db.users.push(newUser);
      writeDb(db);

      console.log(`[REGISTER] New user: ${newUser.email} (${newUser.id})`);

      const userPublic = { id: newUser.id, email: newUser.email, fullName: newUser.fullName, currency: newUser.currency };
      return sendJson(res, 201, {
        success: true,
        message: "Registrasi berhasil.",
        accessToken: "token_" + newUser.id + "_" + Date.now(),
        user: userPublic,
      });
    }

    // ── Auth Login ──────────────────────────────────────────────────────────────
    if (pathname === "/api/v1/auth/login" && req.method === "POST") {
      // ── Rate limiting: block if too many failed attempts ─────────────────────
      const rateCheck = checkRateLimit(clientIp);
      if (rateCheck.blocked) {
        return sendJson(res, 429, {
          success: false,
          error: `Terlalu banyak percobaan login. Coba lagi dalam ${rateCheck.waitSec} detik.`,
        });
      }

      const body = await parseBody(req);
      const { email, password } = body;

      // ── Basic presence check ────────────────────────────────────────────────
      const fieldErrors = {};
      if (!email || !email.trim()) fieldErrors.email = "Email wajib diisi.";
      else if (!EMAIL_REGEX.test(email.trim())) fieldErrors.email = "Format email tidak valid.";
      if (!password) fieldErrors.password = "Password wajib diisi.";

      if (Object.keys(fieldErrors).length > 0) {
        return sendJson(res, 400, {
          success: false,
          error: Object.values(fieldErrors)[0],
          fieldErrors,
        });
      }

      const db = readDb();
      const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

      // ── Unified error message to avoid user enumeration ─────────────────────
      if (!user || user.password !== password) {
        console.warn(`[LOGIN FAIL] ip=${clientIp} email=${email}`);
        return sendJson(res, 401, {
          success: false,
          error: "Email atau password salah. Periksa kembali dan coba lagi.",
          fieldErrors: { email: " ", password: "Kredensial tidak cocok." },
        });
      }

      // ── Success: reset rate limit, update login count ────────────────────────
      resetRateLimit(clientIp);
      user.loginCount = (user.loginCount || 0) + 1;
      user.lastLoginAt = new Date().toISOString();
      writeDb(db);

      console.log(`[LOGIN OK] user=${user.email} count=${user.loginCount}`);

      const userPublic = { id: user.id, email: user.email, fullName: user.fullName, currency: user.currency };
      return sendJson(res, 200, {
        success: true,
        message: "Login berhasil.",
        accessToken: "token_" + user.id + "_" + Date.now(),
        user: userPublic,
      });
    }

    // ── Get User Transactions ───────────────────────────────────────────────────
    if (pathname === "/api/v1/transactions" && req.method === "GET") {
      const userId = getUserIdFromReq(req, url.searchParams);
      const db = readDb();
      const userTx = userId ? db.transactions.filter(t => t.userId === userId) : db.transactions;
      return sendJson(res, 200, { success: true, count: userTx.length, data: userTx });
    }

    // ── Add Transaction ─────────────────────────────────────────────────────────
    if (pathname === "/api/v1/transactions" && req.method === "POST") {
      const body = await parseBody(req);
      const userId = body.userId || getUserIdFromReq(req, url.searchParams);
      const db = readDb();
      const newTx = {
        id: body.id || Date.now().toString(),
        userId: userId || "anonymous",
        type: body.type || "expense",
        amount: Number(body.amount) || 0,
        category: body.category || "Lainnya",
        note: body.note || "Transaksi Baru",
        date: body.date || new Date().toISOString().slice(0, 10),
        paymentMethod: body.paymentMethod || "Tunai",
      };
      db.transactions.unshift(newTx);
      writeDb(db);
      return sendJson(res, 201, { success: true, message: "Transaksi berhasil dicatat", data: newTx });
    }

    // ── Delete Transaction ──────────────────────────────────────────────────────
    if (pathname.startsWith("/api/v1/transactions/") && req.method === "DELETE") {
      const id = pathname.split("/").pop();
      const db = readDb();
      db.transactions = db.transactions.filter(t => t.id !== id);
      writeDb(db);
      return sendJson(res, 200, { success: true, message: "Transaksi berhasil dihapus" });
    }

    // ── Get User Budgets ────────────────────────────────────────────────────────
    if (pathname === "/api/v1/budgets" && req.method === "GET") {
      const userId = getUserIdFromReq(req, url.searchParams);
      const db = readDb();
      const userBudgets = userId ? db.budgets.filter(b => b.userId === userId) : db.budgets;
      return sendJson(res, 200, { success: true, data: userBudgets });
    }

    // ── Set Budget ──────────────────────────────────────────────────────────────
    if (pathname === "/api/v1/budgets" && req.method === "POST") {
      const body = await parseBody(req);
      const userId = body.userId || getUserIdFromReq(req, url.searchParams);
      const db = readDb();
      const existing = db.budgets.find(b => (b.id === body.id || b.category === body.category) && b.userId === userId);
      if (existing) {
        existing.limit = Number(body.limit) || existing.limit;
      } else {
        db.budgets.push({
          id: body.id || Date.now().toString(),
          userId: userId || "anonymous",
          category: body.category || "Lainnya",
          limit: Number(body.limit) || 500000,
          icon: body.icon || "✨",
          color: body.color || "#8b5cf6",
        });
      }
      writeDb(db);
      return sendJson(res, 200, { success: true, message: "Anggaran berhasil disimpan", data: db.budgets });
    }

    // ── Get User Schedules ──────────────────────────────────────────────────────
    if (pathname === "/api/v1/schedules" && req.method === "GET") {
      const userId = getUserIdFromReq(req, url.searchParams);
      const db = readDb();
      const userSchedules = userId ? db.schedules.filter(s => s.userId === userId) : db.schedules;
      return sendJson(res, 200, { success: true, data: userSchedules });
    }

    // ── Add Schedule ────────────────────────────────────────────────────────────
    if (pathname === "/api/v1/schedules" && req.method === "POST") {
      const body = await parseBody(req);
      const userId = body.userId || getUserIdFromReq(req, url.searchParams);
      const db = readDb();
      const newEv = {
        id: body.id || Date.now().toString(),
        userId: userId || "anonymous",
        title: body.title || "Agenda Baru",
        date: body.date || new Date().toISOString().slice(0, 10),
        time: body.time || "09:00",
        type: body.type || "task",
        recurring: body.recurring || "none",
        done: false,
        note: body.note || "",
      };
      db.schedules.push(newEv);
      writeDb(db);
      return sendJson(res, 201, { success: true, message: "Agenda berhasil dibuat", data: newEv });
    }

    // ── Toggle Schedule Done ────────────────────────────────────────────────────
    if (pathname.startsWith("/api/v1/schedules/") && pathname.endsWith("/toggle") && req.method === "PATCH") {
      const parts = pathname.split("/");
      const id = parts[parts.length - 2];
      const db = readDb();
      const item = db.schedules.find(s => s.id === id);
      if (item) {
        item.done = !item.done;
        writeDb(db);
        return sendJson(res, 200, { success: true, data: item });
      }
      return sendJson(res, 404, { success: false, message: "Agenda tidak ditemukan" });
    }

    // ── Admin: Clear DB ─────────────────────────────────────────────────────────
    if (pathname === "/api/v1/admin/clear" && req.method === "POST") {
      writeDb(initialData);
      return sendJson(res, 200, { success: true, message: "Database dibersihkan total" });
    }

    // ── OpenRouter AI: Financial Summary & User Management Analysis ───────────
    if (pathname === "/api/v1/ai/summarize" && req.method === "POST") {
      const body = await parseBody(req);
      const { userContext, model, apiKey } = body;

      const db = readDb();
      const userId = userContext?.id || getUserIdFromReq(req, url.searchParams);
      const user = db.users.find(u => u.id === userId) || userContext || { fullName: "Pengguna", currency: "IDR", loginCount: 1 };
      const userTx = db.transactions.filter(t => !userId || t.userId === userId);
      const userBudgets = db.budgets.filter(b => !userId || b.userId === userId);
      const userSchedules = db.schedules.filter(s => !userId || s.userId === userId);

      const income = userTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = userTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const balance = income - expense;
      const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;

      const expCat = {};
      userTx.filter(t => t.type === "expense").forEach(t => {
        expCat[t.category] = (expCat[t.category] || 0) + t.amount;
      });
      const topCategories = Object.entries(expCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

      const systemPrompt = `Anda adalah Antigravity Financial AI Agent yang cerdas.
Tugas Anda adalah membuat analisis mendalam, rangkuman keuangan, umpan balik pengeluaran, dan analisis manajemen pengguna berdasarkan data keuangan berikut.

Format jawaban dalam Markdown yang rapi dan profesional dengan poin:
1. 📊 **Rangkuman Data Keuangan (Financial Summary)**
2. 💡 **Umpan Balik & Analisis Pengeluaran (Financial Feedback)**
3. 👤 **Analisis Perilaku & Manajemen Pengguna (User Management Analysis)**
4. 🎯 **Rekomendasi & Langkah Aksi Konkret (Actionable Advice)**`;

      const userPrompt = `Analisis data berikut:
Nama Pengguna: ${user.fullName} (${user.email || "User"})
Mata Uang: ${user.currency || "IDR"}
Total Login: ${user.loginCount || 1} kali
Total Pemasukan: ${user.currency || "IDR"} ${income.toLocaleString()}
Total Pengeluaran: ${user.currency || "IDR"} ${expense.toLocaleString()}
Saldo Bersih: ${user.currency || "IDR"} ${balance.toLocaleString()}
Rasio Hemat: ${savingsRate}%
Pengeluaran Terbesar: ${topCategories.map(([c, a]) => `${c}: ${a.toLocaleString()}`).join(", ") || "Belum ada"}
Jumlah Budgets: ${userBudgets.length}
Jumlah Agenda: ${userSchedules.length}
Total Transaksi: ${userTx.length}`;

      const aiRes = await callOpenRouterAI({
        model: model || "google/gemini-2.5-flash:free",
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        apiKey,
      });

      if (aiRes.reply) {
        return sendJson(res, 200, {
          success: true,
          provider: aiRes.provider,
          model: aiRes.model,
          summary: aiRes.reply,
          metrics: { income, expense, balance, savingsRate, topCategories, totalTx: userTx.length },
        });
      }

      // Smart Fallback Report
      const fallbackReport = `### 📊 Rangkuman Data Keuangan (Financial Summary)
- **Total Pemasukan:** ${user.currency || "IDR"} ${income.toLocaleString("id-ID")}
- **Total Pengeluaran:** ${user.currency || "IDR"} ${expense.toLocaleString("id-ID")}
- **Saldo Bersih (Net Cashflow):** ${user.currency || "IDR"} ${balance.toLocaleString("id-ID")}
- **Rasio Hemat (Savings Rate):** ${savingsRate}% dari total pemasukan.
- **Kategori Pengeluaran Teratas:** ${topCategories.length > 0 ? topCategories.map(([c, a]) => `**${c}** (Rp ${a.toLocaleString("id-ID")})`).join(", ") : "Belum ada pengeluaran"}.

---

### 💡 Umpan Balik & Analisis Pengeluaran (Financial Feedback)
${savingsRate >= 20
  ? "🟢 **Kondisi Keuangan Sangat Sehat!** Anda berhasil menyisihkan lebih dari 20% pemasukan untuk tabungan/investasi. Pertahankan disiplin ini."
  : savingsRate > 0
  ? "🟡 **Kondisi Keuangan Stabil.** Rasio hemat Anda berada di bawah target ideal (20%). Disarankan menekan pengeluaran tersier."
  : "🔴 **Peringatan Cashflow Negative!** Pengeluaran Anda melebihi pemasukan. Segera tinjau ulang alokasi pengeluaran Anda."}

---

### 👤 Analisis Perilaku & Manajemen Pengguna (User Management Analysis)
- **Aktivitas Akun:** Terdaftar sebagai **${user.fullName}**, telah melakukan login sebanyak **${user.loginCount || 1} kali**.
- **Tingkat Disiplin Pencatatan:** ${userTx.length >= 5 ? "Tinggi (Aktif mencatat transaksi harian)" : "Perlu ditingkatkan (Baru mencatat sedikit transaksi)"}.
- **Manajemen Anggaran:** Mengelola **${userBudgets.length} batas anggaran** dan **${userSchedules.length} agenda keuangan**.

---

### 🎯 Rekomendasi & Langkah Aksi Konkret
1. **Otomatisasi Tabungan:** Sisihkan minimal 10-20% di awal bulan sebelum berbelanja.
2. **Evaluasi Pengeluaran Terbesar:** Batasi pengeluaran di kategori ${topCategories[0]?.[0] || "Lainnya"}.
3. **Manfaatkan Fitur Jadwal:** Catat tanggal tagihan rutin agar menghindari denda keterlambatan.`;

      return sendJson(res, 200, {
        success: true,
        provider: "local_engine",
        model: "smart-local-ai",
        summary: fallbackReport,
        metrics: { income, expense, balance, savingsRate, topCategories, totalTx: userTx.length },
      });
    }

    // ── OpenRouter AI: Interactive Chatbot (Free Q&A) ───────────────────────────
    if (pathname === "/api/v1/ai/chat" && req.method === "POST") {
      const body = await parseBody(req);
      const { message, history = [], userContext, model, apiKey } = body;

      if (!message || !message.trim()) {
        return sendJson(res, 400, { success: false, error: "Pesan tidak boleh kosong." });
      }

      const db = readDb();
      const userId = userContext?.id || getUserIdFromReq(req, url.searchParams);
      const user = db.users.find(u => u.id === userId) || userContext || { fullName: "Pengguna", currency: "IDR" };
      const userTx = db.transactions.filter(t => !userId || t.userId === userId);
      const income = userTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = userTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const balance = income - expense;

      const systemPrompt = `Anda adalah Antigravity AI Assistant, asisten kecerdasan buatan serbaguna yang terintegrasi di aplikasi Mobile Finance Tracker.
Anda dapat menjawab pertanyaan pengguna tentang keuangan maupun topik umum secara GRATIS!

Data keuangan pengguna saat ini:
- Nama: ${user.fullName} (${user.currency || "IDR"})
- Total Saldo: ${user.currency || "IDR"} ${balance.toLocaleString()}
- Total Pemasukan: ${user.currency || "IDR"} ${income.toLocaleString()}
- Total Pengeluaran: ${user.currency || "IDR"} ${expense.toLocaleString()}
- Jumlah Transaksi: ${userTx.length}

Tanggapi pertanyaan dalam Bahasa Indonesia yang ramah, informatif, dan solutif dengan format Markdown.`;

      const formattedHistory = history.map(h => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text,
      }));

      const aiRes = await callOpenRouterAI({
        model: model || "google/gemini-2.5-flash:free",
        systemPrompt,
        messages: [...formattedHistory, { role: "user", content: message }],
        apiKey,
      });

      if (aiRes.reply) {
        return sendJson(res, 200, {
          success: true,
          provider: aiRes.provider,
          model: aiRes.model,
          reply: aiRes.reply,
        });
      }

      // Smart Fallback Chat Engine
      const lowerMsg = message.toLowerCase();
      let fallbackReply = "";

      if (lowerMsg.includes("saldo") || lowerMsg.includes("uang") || lowerMsg.includes("sisa")) {
        fallbackReply = `Saat ini total saldo Anda adalah **${user.currency || "IDR"} ${balance.toLocaleString("id-ID")}** (Pemasukan: Rp ${income.toLocaleString("id-ID")}, Pengeluaran: Rp ${expense.toLocaleString("id-ID")}).`;
      } else if (lowerMsg.includes("hemat") || lowerMsg.includes("tips") || lowerMsg.includes("alokasi")) {
        fallbackReply = `💡 **Tips Alokasi Keuangan 50/30/20:**\n\n1. **50% Kebutuhan Pokok:** Makanan, sewa, tagihan listrik & air.\n2. **30% Keinginan (Wants):** Hiburan, belanja, rekreasi.\n3. **20% Tabungan & Investasi:** Tabungan darurat dan instrumen investasi.`;
      } else if (lowerMsg.includes("siapa kamu") || lowerMsg.includes("ai")) {
        fallbackReply = `Saya adalah **Antigravity AI Assistant**, AI cerdas yang siap membantu Anda mengelola keuangan, memberikan rekomendasi budget, serta menjawab pertanyaan umum apapun secara GRATIS! 🤖✨`;
      } else {
        fallbackReply = `Terima kasih atas pertanyaannya! Berdasarkan catatan Anda, Anda memiliki **${userTx.length} transaksi** dengan total saldo **${user.currency || "IDR"} ${balance.toLocaleString("id-ID")}**.\n\nJika ada topik tertentu mengenai perencanaan budget, cara berinvestasi, atau tips finansial harian yang ingin Anda diskusikan, silakan tanyakan kepada saya! 🚀`;
      }

      return sendJson(res, 200, {
        success: true,
        provider: "local_engine",
        model: "smart-local-ai",
        reply: fallbackReply,
      });
    }

    // ── Alight Motion Premium API Proxy & PoW Helper ────────────────────────────
    if (pathname === "/api/v1/alight-motion/stats" && req.method === "GET") {
      try {
        const BASE = "https://www.alightpro.my.id";
        const [a, b] = await Promise.all([
          fetch(`${BASE}/api/stats`).then(r => r.json()).catch(() => null),
          fetch(`${BASE}/api/stats/recent`).then(r => r.json()).catch(() => null),
        ]);
        return sendJson(res, 200, { success: true, stats: a, recent: b });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (pathname === "/api/v1/alight-motion/request" && req.method === "POST") {
      try {
        const body = await parseBody(req);
        const { action, email, link } = body;

        if (!action || !["send", "verify"].includes(action)) {
          return sendJson(res, 400, { success: false, error: "Action 'send' atau 'verify' wajib diisi." });
        }

        if (action === "send" && (!email || !email.trim())) {
          return sendJson(res, 400, { success: false, error: "Email wajib diisi." });
        }

        if (action === "verify" && (!link || !link.trim())) {
          return sendJson(res, 400, { success: false, error: "Link verifikasi wajib diisi." });
        }

        const BASE = "https://www.alightpro.my.id";
        const sessRes = await fetch(`${BASE}/api/session`, {
          headers: {
            "accept": "*/*",
            "x-requested-with": "XMLHttpRequest",
            "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36",
          }
        });

        let cookie = "";
        if (typeof sessRes.headers.getSetCookie === "function") {
          const cookies = sessRes.headers.getSetCookie();
          if (cookies && cookies.length > 0) {
            cookie = cookies.map(c => c.split(";")[0]).join("; ");
          }
        }
        if (!cookie) {
          const rawHeader = sessRes.headers.get("set-cookie") || "";
          cookie = rawHeader ? rawHeader.split(";")[0] : "";
        }
        const sessData = await sessRes.json();

        if (!sessData || !sessData.status || !sessData.token || !sessData.nonce) {
          return sendJson(res, 500, { success: false, error: "Gagal mendapatkan sesi dari server Alight Motion." });
        }

        const { token, nonce, sessionId, difficulty = "0000" } = sessData;
        const targetEmail = (email || "").trim().toLowerCase();

        // Solve PoW in Node.js
        const prefix = `${sessionId}:${nonce}:${targetEmail}:${action}:`;
        let pow = String(Date.now());
        for (let i = 0; i < 500000; i++) {
          const hash = crypto.createHash("sha256").update(prefix + i, "utf8").digest("hex");
          if (hash.startsWith(difficulty)) {
            pow = String(i);
            break;
          }
        }

        const reqHeaders = {
          "content-type": "application/json",
          "accept": "*/*",
          "x-requested-with": "XMLHttpRequest",
          "x-amprem-token": token,
          "x-amprem-nonce": nonce,
          "x-amprem-pow": pow,
          "referer": `${BASE}/`,
          "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36",
        };
        if (cookie) reqHeaders["cookie"] = cookie;

        const postRes = await fetch(`${BASE}/api/alight-motion`, {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify({ action, email: targetEmail, link: link ? link.trim() : undefined }),
        });

        const resultData = await postRes.json();
        return sendJson(res, 200, resultData);
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    return sendJson(res, 404, { success: false, error: "Endpoint tidak ditemukan" });

  } catch (err) {
    console.error("API Server Error:", err);
    return sendJson(res, 500, { success: false, error: err.message || "Internal Server Error" });
  }
});

server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.log(`⚠️  Port ${PORT} sudah digunakan. Server mungkin sudah berjalan di http://localhost:${PORT}/api/v1`);
  } else {
    console.error("Server error:", err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Mobile Finance Tracker Server & API — http://localhost:${PORT}`);
  console.log(`   Web App Frontend : ✅  Serving static dist/ build`);
  console.log(`   Auth validation  : ✅  email · password strength · name rules`);
  console.log(`   Rate limiting    : ✅  ${RATE_LIMIT_MAX} attempts / ${RATE_LIMIT_WINDOW_MS / 1000}s per IP`);
});

export default function handler(req, res) {
  server.emit("request", req, res);
}
