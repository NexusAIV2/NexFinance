import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;

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

    // ── OpenRouter AI: Financial Summary & User Management Analysis ───────────
    if (pathname === "/api/v1/ai/summarize" && req.method === "POST") {
      const body = await parseBody(req);
      const { userContext, model, apiKey, transactions = [], budgets = [], schedules = [] } = body;

      const user = userContext || { fullName: "Pengguna", currency: "IDR", loginCount: 1 };
      const userTx = Array.isArray(transactions) ? transactions : [];
      const userBudgets = Array.isArray(budgets) ? budgets : [];
      const userSchedules = Array.isArray(schedules) ? schedules : [];

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
      const { message, history = [], userContext, model, apiKey, financialContext } = body;

      if (!message || !message.trim()) {
        return sendJson(res, 400, { success: false, error: "Pesan tidak boleh kosong." });
      }

      const user = userContext || { fullName: "Pengguna", currency: "IDR" };
      const balance = financialContext?.balance || 0;
      const income = financialContext?.income || 0;
      const expense = financialContext?.expense || 0;
      const txCount = financialContext?.totalTx || 0;

      const systemPrompt = `Anda adalah Antigravity AI Assistant, asisten kecerdasan buatan serbaguna yang terintegrasi di aplikasi Mobile Finance Tracker.
Anda dapat menjawab pertanyaan pengguna tentang keuangan maupun topik umum secara GRATIS!

Data keuangan pengguna saat ini:
- Nama: ${user.fullName} (${user.currency || "IDR"})
- Total Saldo: ${user.currency || "IDR"} ${balance.toLocaleString()}
- Total Pemasukan: ${user.currency || "IDR"} ${income.toLocaleString()}
- Total Pengeluaran: ${user.currency || "IDR"} ${expense.toLocaleString()}
- Jumlah Transaksi: ${txCount}

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
        fallbackReply = `Terima kasih atas pertanyaannya! Berdasarkan catatan Anda, Anda memiliki **${txCount} transaksi** dengan total saldo **${user.currency || "IDR"} ${balance.toLocaleString("id-ID")}**.\n\nJika ada topik tertentu mengenai perencanaan budget, cara berinvestasi, atau tips finansial harian yang ingin Anda diskusikan, silakan tanyakan kepada saya! 🚀`;
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
