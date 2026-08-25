import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ShinigamiReader from "./ShinigamiReader";
import AnichinStreamer from "./AnichinStreamer";

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "transactions" | "budget" | "schedule" | "ai" | "settings";
type TxType = "income" | "expense";
type RecurringRule = "none" | "daily" | "weekly" | "monthly" | "yearly";
type Currency = "IDR" | "USD" | "SGD" | "EUR";
type ThemeColor = "violet" | "emerald" | "ocean" | "amber" | "rose";

export const THEME_STYLES: Record<ThemeColor, {
  name: string;
  gradient: string;
  glow: string;
  text: string;
  bgBadge: string;
  border: string;
  hex: string;
  btnGradient: string;
}> = {
  violet: {
    name: "Violet",
    gradient: "from-violet-600 via-indigo-600 to-purple-600",
    glow: "shadow-[0_0_22px_rgba(139,92,246,0.55)]",
    text: "text-violet-400",
    bgBadge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    border: "border-violet-500/30",
    hex: "#8b5cf6",
    btnGradient: "from-violet-600 to-indigo-600",
  },
  emerald: {
    name: "Emerald",
    gradient: "from-emerald-600 via-teal-600 to-green-600",
    glow: "shadow-[0_0_22px_rgba(16,185,129,0.55)]",
    text: "text-emerald-400",
    bgBadge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    border: "border-emerald-500/30",
    hex: "#10b981",
    btnGradient: "from-emerald-600 to-teal-600",
  },
  ocean: {
    name: "Ocean",
    gradient: "from-sky-500 via-cyan-600 to-blue-600",
    glow: "shadow-[0_0_22px_rgba(6,182,212,0.55)]",
    text: "text-cyan-400",
    bgBadge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    border: "border-cyan-500/30",
    hex: "#06b6d4",
    btnGradient: "from-sky-500 to-cyan-600",
  },
  amber: {
    name: "Amber",
    gradient: "from-amber-500 via-orange-600 to-yellow-500",
    glow: "shadow-[0_0_22px_rgba(245,158,11,0.55)]",
    text: "text-amber-400",
    bgBadge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    border: "border-amber-500/30",
    hex: "#f59e0b",
    btnGradient: "from-amber-500 to-orange-600",
  },
  rose: {
    name: "Rose",
    gradient: "from-rose-600 via-pink-600 to-fuchsia-600",
    glow: "shadow-[0_0_22px_rgba(244,63,94,0.55)]",
    text: "text-rose-400",
    bgBadge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    border: "border-rose-500/30",
    hex: "#f43f5e",
    btnGradient: "from-rose-600 to-pink-600",
  },
};

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  date: string;
  paymentMethod: string;
}

interface BudgetItem {
  id: string;
  category: string;
  limit: number;
  icon: string;
  color: string;
}

interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: "meeting" | "reminder" | "task" | "personal";
  recurring: RecurringRule;
  done: boolean;
  note?: string;
  remindMinutes?: number;
}

interface CustomCategory {
  name: string;
  icon: string;
  color: string;
  type: TxType;
}

// ─── Initial Seed Data ────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES: Record<string, { icon: string; color: string; type?: TxType }> = {
  "Makanan": { icon: "fa-solid fa-utensils", color: "#f97316", type: "expense" },
  "Transport": { icon: "fa-solid fa-car", color: "#3b82f6", type: "expense" },
  "Belanja": { icon: "fa-solid fa-bag-shopping", color: "#ec4899", type: "expense" },
  "Hiburan": { icon: "fa-solid fa-gamepad", color: "#8b5cf6", type: "expense" },
  "Kesehatan": { icon: "fa-solid fa-notes-medical", color: "#14b8a6", type: "expense" },
  "Pendidikan": { icon: "fa-solid fa-book-open", color: "#f59e0b", type: "expense" },
  "Utilitas": { icon: "fa-solid fa-bolt", color: "#6366f1", type: "expense" },
  "Gaji": { icon: "fa-solid fa-briefcase", color: "#22c55e", type: "income" },
  "Freelance": { icon: "fa-solid fa-laptop-code", color: "#06b6d4", type: "income" },
  "Investasi": { icon: "fa-solid fa-chart-line", color: "#a855f7", type: "income" },
  "Lainnya": { icon: "fa-solid fa-shapes", color: "#64748b" },
};

const EVENT_COLORS: Record<string, string> = {
  meeting: "#8b5cf6",
  reminder: "#f59e0b",
  task: "#14b8a6",
  personal: "#ec4899",
};

interface User {
  id: string;
  email: string;
  fullName: string;
  currency: Currency;
  avatarUrl?: string;
  coverUrl?: string;
}

// ─── i18n Translation Dictionary ──────────────────────────────────────────────
type Lang = "ID" | "EN";

const TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Navigation Bar
  nav_home: { ID: "Beranda", EN: "Home" },
  nav_transactions: { ID: "Transaksi", EN: "Transactions" },
  nav_budget: { ID: "Anggaran", EN: "Budget" },
  nav_schedule: { ID: "Jadwal", EN: "Schedule" },
  nav_ai: { ID: "AI Chat", EN: "AI Chat" },
  nav_profile: { ID: "Profil", EN: "Profile" },

  // Dashboard Header & Overview
  welcome_back: { ID: "Selamat datang kembali,", EN: "Welcome back," },
  total_balance: { ID: "Total Saldo", EN: "Total Balance" },
  income: { ID: "Pemasukan", EN: "Income" },
  expense: { ID: "Pengeluaran", EN: "Expenses" },
  quick_stats: { ID: "Statistik Cepat", EN: "Quick Stats" },
  recent_transactions: { ID: "Transaksi Terbaru", EN: "Recent Transactions" },
  upcoming_schedule: { ID: "Jadwal & Tagihan Mendatang", EN: "Upcoming Agenda & Bills" },
  view_all: { ID: "Lihat Semua", EN: "View All" },
  no_transactions: { ID: "Belum ada transaksi", EN: "No transactions recorded" },
  no_events: { ID: "Tidak ada jadwal mendatang", EN: "No upcoming events" },
  add_transaction: { ID: "Tambah Transaksi", EN: "Add Transaction" },

  // Transactions Tab
  transaction_history: { ID: "Riwayat Transaksi", EN: "Transaction History" },
  all_types: { ID: "Semua Tipe", EN: "All Types" },
  search_placeholder: { ID: "Cari transaksi...", EN: "Search transactions..." },
  amount: { ID: "Jumlah Nominal", EN: "Amount" },
  category: { ID: "Kategori", EN: "Category" },
  date: { ID: "Tanggal", EN: "Date" },
  description: { ID: "Keterangan", EN: "Description" },
  type: { ID: "Tipe", EN: "Type" },
  delete: { ID: "Hapus", EN: "Delete" },
  save: { ID: "Simpan", EN: "Save" },
  cancel: { ID: "Batal", EN: "Cancel" },

  // Budget Tab
  budget_planning: { ID: "Perencanaan Anggaran", EN: "Budget Planning" },
  total_budget: { ID: "Total Anggaran", EN: "Total Budget" },
  used_budget: { ID: "Terpakai", EN: "Used" },
  remaining_budget: { ID: "Sisa Anggaran", EN: "Remaining Budget" },
  limit: { ID: "Batas Max", EN: "Max Limit" },
  edit_limit: { ID: "Ubah Batas", EN: "Edit Limit" },
  add_category: { ID: "Tambah Kategori", EN: "Add Category" },
  safe_status: { ID: "Aman", EN: "Safe" },
  warning_status: { ID: "Hampir Penuh", EN: "Near Limit" },

  // Schedule Tab
  schedule_title: { ID: "Jadwal & Tagihan", EN: "Schedule & Bills" },
  schedule_subtitle: { ID: "Kelola pengingat pembayaran & agenda keuangan Anda", EN: "Manage payment reminders & financial agenda" },
  add_schedule: { ID: "Tambah Agenda", EN: "Add Agenda Event" },
  event_name: { ID: "Nama Agenda / Tagihan", EN: "Event / Bill Name" },
  due_date: { ID: "Jatuh Tempo", EN: "Due Date" },
  status: { ID: "Status", EN: "Status" },
  completed: { ID: "Selesai", EN: "Completed" },
  pending: { ID: "Belum Selesai", EN: "Pending" },
  mark_complete: { ID: "Tandai Selesai", EN: "Mark Complete" },

  // AI Chat Tab
  ai_welcome: { ID: "Ada yang bisa saya bantu hari ini?", EN: "What should we focus on today?" },
  ai_input_placeholder: { ID: "Tanyakan pada AI...", EN: "Ask AI..." },
  ai_thinking: { ID: "AI sedang berpikir...", EN: "AI is thinking..." },
  chat_history: { ID: "Riwayat Chat", EN: "Chat History" },
  new_chat: { ID: "Percakapan Baru", EN: "New Chat" },
  no_chat_history: { ID: "Belum ada riwayat percakapan", EN: "No chat history yet" },

  // Settings & Profile Tab
  settings_title: { ID: "Pengaturan & Profil", EN: "Settings & Profile" },
  settings_subtitle: { ID: "Kelola akun, preferensi aplikasi, dan keamanan data", EN: "Manage account, app preferences, and data security" },
  edit_profile: { ID: "Edit Profil", EN: "Edit Profile" },
  logout: { ID: "Keluar", EN: "Logout" },
  app_preferences: { ID: "Preferensi Aplikasi", EN: "App Preferences" },
  main_currency: { ID: "Mata Uang Utama", EN: "Main Currency" },
  currency_sub: { ID: "Format standar nominal transaksi & laporan", EN: "Standard currency for transactions & reports" },
  visual_theme: { ID: "Mode Tampilan Visual", EN: "Visual Theme" },
  dark_mode_sub: { ID: "Mode Gelap (OLED Deep Glassmorphism)", EN: "Dark Mode (OLED Deep Glassmorphism)" },
  theme_color_title: { ID: "Warna Tema Aksen", EN: "Theme Accent Color" },
  theme_color_sub: { ID: "Pilih skema warna utama antarmuka", EN: "Choose main interface color scheme" },
  system_language: { ID: "Bahasa Sistem", EN: "System Language" },
  system_language_sub: { ID: "Bahasa pengantar antarmuka", EN: "Interface language preference" },
  notifications_sec: { ID: "Notifikasi & Keamanan", EN: "Notifications & Security" },
  push_notif: { ID: "Notifikasi & Pengingat Agenda", EN: "Notifications & Reminders" },
  push_notif_sub: { ID: "Dapatkan pengingat otomatis untuk agenda jatuh tempo", EN: "Get automatic reminders for due agenda items" },
  pin_lock: { ID: "Kunci PIN 4-Digit", EN: "4-Digit PIN Lock" },
  pin_lock_sub: { ID: "Kunci aplikasi otomatis saat dibuka & 5 menit tanpa aktivitas", EN: "Auto-lock app on open & after 5 min inactivity" },
  change_pin: { ID: "Ubah PIN", EN: "Change PIN" },
  cloud_sync: { ID: "Sinkronisasi Otomatis Cloud", EN: "Cloud Auto-Sync" },
  cloud_sync_sub: { ID: "Simpan perubahan instan ke server database", EN: "Instantly save changes to database server" },
  ai_config_title: { ID: "Konfigurasi AI Assistant", EN: "AI Assistant Configuration" },
  ai_key_status: { ID: "Status OpenRouter API Key", EN: "OpenRouter API Key Status" },
  key_active: { ID: "API Key tersimpan dan aktif 🔑", EN: "API Key saved and active 🔑" },
  key_inactive: { ID: "API Key belum dikonfigurasi", EN: "API Key not configured" },
  manage_key: { ID: "Kelola Key", EN: "Manage Key" },
  set_key: { ID: "Atur API Key", EN: "Set API Key" },
  data_backup_title: { ID: "Backup & Pemulihan Data", EN: "Backup & Data Recovery" },
  backup_sub: { ID: "Cadangkan seluruh transaksi & catatan ke format JSON", EN: "Backup all transactions & notes to JSON format" },
  export_json: { ID: "Export Backup (JSON)", EN: "Export Backup (JSON)" },
  import_json: { ID: "Import Data Backup", EN: "Import Data Backup" },
  danger_zone: { ID: "Zona Bahaya & Akun", EN: "Danger Zone & Account" },
  clear_data_sub: { ID: "Menghapus seluruh transaksi, anggaran & jadwal lokal", EN: "Delete all local transactions, budget & schedule data" },
  reset_button: { ID: "Hapus Seluruh Data Transaksi", EN: "Reset All Transaction Data" },
  info_help_title: { ID: "Informasi & Bantuan", EN: "Information & Help" },
  faq_center: { ID: "Pusat Bantuan & FAQ", EN: "Help Center & FAQ" },
  version_info: { ID: "Versi Aplikasi", EN: "App Version" },
  items: { ID: "Item", EN: "Items" },
  categories: { ID: "Kategori", EN: "Categories" },
  agenda: { ID: "Agenda", EN: "Events" },
  active: { ID: "Aktif", EN: "Active" },
  inactive: { ID: "Nonaktif", EN: "Disabled" },
  edit_profile_title: { ID: "Edit Informasi Profil", EN: "Edit Profile Information" },
  full_name: { ID: "Nama Lengkap", EN: "Full Name" },
  email_address: { ID: "Alamat Email", EN: "Email Address" },
};

function t(key: string, lang: Lang = "ID"): string {
  return TRANSLATIONS[key]?.[lang] || key;
}

// Clean Initial State (No sample mock data)
const INITIAL_TRANSACTIONS: Transaction[] = [];
const INITIAL_BUDGET: BudgetItem[] = [
  { id: "b1", category: "Makanan", limit: 1500000, icon: "fa-solid fa-utensils", color: "#f97316" },
  { id: "b2", category: "Transport", limit: 800000, icon: "fa-solid fa-car", color: "#3b82f6" },
  { id: "b3", category: "Belanja", limit: 1200000, icon: "fa-solid fa-bag-shopping", color: "#ec4899" },
  { id: "b4", category: "Hiburan", limit: 500000, icon: "fa-solid fa-gamepad", color: "#8b5cf6" },
  { id: "b5", category: "Kesehatan", limit: 600000, icon: "fa-solid fa-notes-medical", color: "#14b8a6" },
  { id: "b6", category: "Utilitas", limit: 500000, icon: "fa-solid fa-bolt", color: "#6366f1" },
];
const INITIAL_EVENTS: ScheduleEvent[] = [];

// CategoryIcon component to safely render FontAwesome icons or legacy icons
function CategoryIcon({ icon, className = "" }: { icon?: string; className?: string }) {
  if (!icon) return <i className={`fa-solid fa-tags ${className}`} />;
  if (icon.includes("fa-") || icon.startsWith("fa")) {
    return <i className={`${icon} ${className}`} />;
  }
  return <span className={className}>{icon}</span>;
}

// ─── Currency Helpers ─────────────────────────────────────────────────────────
const CURRENCY_CONFIG: Record<Currency, { symbol: string; rate: number; locale: string }> = {
  IDR: { symbol: "Rp ", rate: 1, locale: "id-ID" },
  USD: { symbol: "$ ", rate: 0.000065, locale: "en-US" },
  SGD: { symbol: "S$ ", rate: 0.000087, locale: "en-SG" },
  EUR: { symbol: "€ ", rate: 0.000060, locale: "de-DE" },
};

function formatCurrency(n: number, currency: Currency = "IDR"): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.IDR;
  const converted = n * cfg.rate;

  if (currency === "IDR") {
    return cfg.symbol + Math.round(converted).toLocaleString(cfg.locale);
  }
  return cfg.symbol + converted.toLocaleString(cfg.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShortCurrency(n: number, currency: Currency = "IDR"): string {
  if (currency !== "IDR") return formatCurrency(n, currency);
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

// Local-time date string "YYYY-MM-DD" (avoids UTC off-by-one from toISOString)
const getLocalDateStr = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ─── Background Ambient Particle Component ─────────────────────────────────────
function AuroraBackground({ themeColor = "violet", darkMode = true }: { themeColor?: ThemeColor; darkMode?: boolean }) {
  const hex = THEME_STYLES[themeColor]?.hex || "#8b5cf6";
  const opacityMult = darkMode ? 1 : 0.6;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute animate-float transition-all duration-700"
        style={{
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${hex}66 0%, transparent 70%)`,
          top: "-120px", left: "-120px",
          opacity: 0.3 * opacityMult,
        }}
      />
      <div
        className="absolute animate-float-delay transition-all duration-700"
        style={{
          width: 450, height: 450, borderRadius: "50%",
          background: `radial-gradient(circle, ${hex}44 0%, transparent 70%)`,
          top: "30%", right: "-100px",
          opacity: 0.25 * opacityMult,
        }}
      />
      <div
        className="absolute animate-float-slow transition-all duration-700"
        style={{
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${hex}33 0%, transparent 70%)`,
          bottom: "5%", left: "10%",
          opacity: 0.2 * opacityMult,
        }}
      />
    </div>
  );
}

// ─── Toast Notification Component ──────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: "success" | "info" | "alert"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const borderGlow =
    type === "success"
      ? "border-emerald-500/40 shadow-[0_8px_32px_rgba(16,185,129,0.25)]"
      : type === "alert"
      ? "border-rose-500/40 shadow-[0_8px_32px_rgba(244,63,94,0.25)]"
      : "border-violet-500/40 shadow-[0_8px_32px_rgba(139,92,246,0.25)]";

  const iconBg =
    type === "success"
      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
      : type === "alert"
      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
      : "bg-violet-500/20 text-violet-300 border border-violet-500/30";

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] px-4 py-2.5 rounded-2xl bg-[#0b0d1e]/95 backdrop-blur-2xl text-slate-100 text-xs font-medium flex items-center gap-3 animate-slide-up border ${borderGlow} max-w-sm w-auto shadow-2xl select-none`}
    >
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${iconBg}`}>
        {type === "success" ? (
          <i className="fa-solid fa-check text-emerald-400" />
        ) : type === "alert" ? (
          <i className="fa-solid fa-triangle-exclamation text-rose-400" />
        ) : (
          <i className="fa-solid fa-info text-violet-300" />
        )}
      </div>
      <span className="truncate pr-1 text-slate-200">{message}</span>
      <button
        onClick={onClose}
        className="w-5 h-5 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors ml-auto flex-shrink-0"
      >
        <i className="fa-solid fa-xmark text-xs" />
      </button>
    </div>
  );
}

// ─── Glassmorphism Delete Confirmation Modal Component ───────────────────────
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Ya, Hapus",
  cancelText = "Batal",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in select-none">
      <div
        className="w-full max-w-sm rounded-3xl p-5 border border-rose-500/30 text-white shadow-2xl animate-scale-up"
        style={{
          backgroundColor: "#0f172a",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(244, 63, 94, 0.25)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-lg flex-shrink-0 text-rose-400">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">{title}</h3>
            <p className="text-[11px] text-rose-400 font-semibold tracking-wide uppercase">Konfirmasi Hapus</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-5 bg-white/5 p-3 rounded-xl border border-white/10">
          {message}
        </p>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white glass border border-white/15 hover:bg-white/10 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-600/30 transition-all active:scale-95 border border-rose-400/40"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Custom Minimalist Glassmorphism Dropdown Select Component ──────────────
interface CustomDropdownOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

function CustomDropdown<T extends string = string>({
  value,
  options,
  onChange,
  className = "",
  placeholder = "Pilih...",
}: {
  value: T;
  options: CustomDropdownOption<T>[];
  onChange: (val: T) => void;
  className?: string;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);

  const selectedOpt = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && containerEl && !containerEl.contains(e.target as Node)) {
        const targetNode = e.target as Node;
        const portalNode = document.getElementById("dropdown-portal-popover");
        if (portalNode && portalNode.contains(targetNode)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, containerEl]);

  return (
    <div
      ref={setContainerEl}
      className={`relative inline-block text-left ${className}`}
    >
      {/* Trigger Button */}
      <button
        ref={setButtonEl}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 glass border border-white/15 hover:border-violet-500/50 hover:bg-white/10 active:scale-[0.98] shadow-md focus:outline-none custom-dropdown-btn"
      >
        <span className="truncate flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
          {selectedOpt?.icon && <span>{selectedOpt.icon}</span>}
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-violet-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Options Dropdown Menu rendered via Portal */}
      {isOpen &&
        buttonEl &&
        createPortal(
          <div
            id="dropdown-portal-popover"
            className="fixed rounded-2xl p-1.5 z-[9999] shadow-2xl border border-white/20 animate-slide-up select-none custom-dropdown-popover"
            style={{
              top: `${buttonEl.getBoundingClientRect().bottom + window.scrollY + 6}px`,
              left: `${buttonEl.getBoundingClientRect().left + window.scrollX}px`,
              width: `${buttonEl.getBoundingClientRect().width}px`,
              minWidth: "160px",
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 mb-0.5 last:mb-0 ${
                    isSelected
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold border border-violet-400/40 shadow-sm preserve-white"
                      : "custom-dropdown-opt-inactive hover:bg-white/10"
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    {option.icon && <span>{option.icon}</span>}
                    {option.label}
                  </span>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-violet-300 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── Custom Minimalist Glassmorphism DatePicker Component ────────────────────
function CustomDatePicker({
  value,
  onChange,
  className = "",
}: {
  value: string; // YYYY-MM-DD format
  onChange: (dateStr: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);

  // Parse YYYY-MM-DD into Date object or fallback to today
  const selectedDate = useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [value]);

  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth()); // 0 - 11

  // Update view when selected value changes
  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && containerEl && !containerEl.contains(e.target as Node)) {
        // Also check if click is inside portal popover
        const targetNode = e.target as Node;
        const portalNode = document.getElementById("datepicker-portal-popover");
        if (portalNode && portalNode.contains(targetNode)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, containerEl]);

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const DAY_NAMES = ["Ming", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  // Calendar days grid generator
  const daysGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; currentMonth: boolean; dateStr: string }[] = [];

    // Previous month padding days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const pDay = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, pDay);
      const yStr = prevDate.getFullYear();
      const mStr = String(prevDate.getMonth() + 1).padStart(2, "0");
      const dStr = String(pDay).padStart(2, "0");
      cells.push({ day: pDay, currentMonth: false, dateStr: `${yStr}-${mStr}-${dStr}` });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(viewMonth + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      cells.push({ day: d, currentMonth: true, dateStr: `${viewYear}-${mStr}-${dStr}` });
    }

    // Next month padding days to complete 42 cells (6 rows x 7 days)
    const remaining = 42 - cells.length;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(viewYear, viewMonth + 1, n);
      const yStr = nextDate.getFullYear();
      const mStr = String(nextDate.getMonth() + 1).padStart(2, "0");
      const dStr = String(n).padStart(2, "0");
      cells.push({ day: n, currentMonth: false, dateStr: `${yStr}-${mStr}-${dStr}` });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const formattedDisplay = useMemo(() => {
    if (!value) return "Pilih Tanggal";
    const d = selectedDate;
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTH_NAMES[d.getMonth()].slice(0, 3);
    return `${day} ${month} ${d.getFullYear()}`;
  }, [value, selectedDate]);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  // Compute portal position
  const portalStyle = useMemo(() => {
    if (!buttonEl) return {};
    const rect = buttonEl.getBoundingClientRect();
    const popoverWidth = 270;
    let left = rect.right - popoverWidth;
    if (left < 10) left = rect.left;
    if (left < 10) left = 10;

    return {
      top: `${rect.bottom + window.scrollY + 6}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      backgroundColor: "#0f172a",
      boxShadow: "0 20px 45px rgba(0, 0, 0, 0.95), 0 0 30px rgba(139, 92, 246, 0.4)",
    };
  }, [buttonEl, isOpen]);

  return (
    <div ref={setContainerEl} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        ref={setButtonEl}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 glass border border-white/15 hover:border-violet-500/50 hover:bg-white/10 active:scale-[0.98] shadow-md focus:outline-none"
        style={{
          background: isOpen ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.06)",
        }}
      >
        <span className="truncate text-slate-100 font-medium font-mono">
          {formattedDisplay}
        </span>
        <svg className="w-4 h-4 text-violet-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar Popover Picker rendered via Portal */}
      {isOpen &&
        createPortal(
          <div
            id="datepicker-portal-popover"
            className="fixed rounded-2xl p-3 z-[9999] shadow-2xl border border-white/20 animate-slide-up select-none"
            style={portalStyle}
          >
            {/* Header Navigation */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg glass flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              >
                ‹
              </button>

              <span className="text-xs font-bold text-violet-200 tracking-wide font-mono">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg glass flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              >
                ›
              </button>
            </div>

            {/* Days of Week Row */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {DAY_NAMES.map((d) => (
                <span key={d} className="text-[10px] font-bold text-violet-400/70 uppercase">
                  {d}
                </span>
              ))}
            </div>

            {/* Date Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {daysGrid.map((item, idx) => {
                const isSelected = item.dateStr === value;
                const isToday = item.dateStr === todayStr;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onChange(item.dateStr);
                      setIsOpen(false);
                    }}
                    className={`h-7 w-7 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-center mx-auto ${
                      isSelected
                        ? "bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold shadow-md shadow-violet-500/30 scale-105 border border-violet-300/40"
                        : isToday
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                        : item.currentMonth
                        ? "text-slate-200 hover:bg-white/10 hover:text-white"
                        : "text-slate-600 hover:bg-white/5"
                    }`}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>

            {/* Quick Action Footer */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  onChange(todayStr);
                  setIsOpen(false);
                }}
                className="text-violet-400 hover:text-violet-200 font-semibold transition-colors"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}


// ─── Custom Minimalist Glassmorphism TimePicker Component ────────────────────
function CustomTimePicker({
  value,
  onChange,
  className = "",
}: {
  value: string; // "HH:mm" 24-hour format
  onChange: (timeStr: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);

  const [h24, m] = useMemo(() => {
    const [hh, mm] = (value || "09:00").split(":").map(Number);
    return [isNaN(hh) ? 9 : hh, isNaN(mm) ? 0 : mm];
  }, [value]);

  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  // Local draft strings so the user can freely type into the big display
  const [hourDraft, setHourDraft] = useState("");
  const [minuteDraft, setMinuteDraft] = useState("");

  const commit = (nextH12: number, nextMin: number, nextPeriod: "AM" | "PM") => {
    let hour24 = nextH12 % 12;
    if (nextPeriod === "PM") hour24 += 12;
    const hh = String(hour24).padStart(2, "0");
    const mm = String(nextMin).padStart(2, "0");
    onChange(`${hh}:${mm}`);
  };

  // Sync drafts from the canonical value whenever the picker opens or value changes
  useEffect(() => {
    setHourDraft(String(h12).padStart(2, "0"));
    setMinuteDraft(String(m).padStart(2, "0"));
  }, [h12, m, isOpen]);

  const commitHourDraft = () => {
    let n = parseInt(hourDraft, 10);
    if (isNaN(n)) {
      setHourDraft(String(h12).padStart(2, "0"));
      return;
    }
    n = Math.min(12, Math.max(1, n));
    commit(n, m, period);
  };

  const commitMinuteDraft = () => {
    let n = parseInt(minuteDraft, 10);
    if (isNaN(n)) {
      setMinuteDraft(String(m).padStart(2, "0"));
      return;
    }
    n = Math.min(59, Math.max(0, n));
    commit(h12, n, period);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && containerEl && !containerEl.contains(e.target as Node)) {
        const portalNode = document.getElementById("timepicker-portal-popover");
        if (portalNode && portalNode.contains(e.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, containerEl]);

  const display = useMemo(() => {
    const mm = String(m).padStart(2, "0");
    return `${String(h12).padStart(2, "0")}:${mm} ${period}`;
  }, [h12, m, period]);

  const portalStyle = useMemo(() => {
    if (!buttonEl) return {};
    const rect = buttonEl.getBoundingClientRect();
    const width = Math.max(rect.width, 230);
    let left = rect.left + window.scrollX;
    if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;
    if (left < 10) left = 10;
    return {
      top: `${rect.bottom + window.scrollY + 6}px`,
      left: `${left}px`,
      width: `${width}px`,
      backgroundColor: "#0f172a",
      boxShadow: "0 20px 45px rgba(0,0,0,0.95), 0 0 30px rgba(139,92,246,0.4)",
    };
  }, [buttonEl, isOpen]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const stepMinute = (dir: number) => {
    let next = m + dir * 5;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    commit(h12, next, period);
  };

  return (
    <div ref={setContainerEl} className={`relative inline-block text-left ${className}`}>
      <button
        ref={setButtonEl}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 glass border border-white/15 hover:border-violet-500/50 hover:bg-white/10 active:scale-[0.98] shadow-md focus:outline-none"
        style={{ background: isOpen ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)" }}
      >
        <span className="truncate text-slate-100 font-medium font-mono tracking-wide">{display}</span>
        <svg className="w-4 h-4 text-violet-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div
            id="timepicker-portal-popover"
            className="fixed rounded-2xl p-3 z-[9999] shadow-2xl border border-white/20 animate-slide-up select-none"
            style={portalStyle}
          >
            {/* Big Live Display — editable, type directly */}
            <div className="flex items-center justify-center gap-1.5 mb-3 pb-3 border-b border-white/10">
              <input
                type="text"
                inputMode="numeric"
                value={hourDraft}
                onChange={e => setHourDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={commitHourDraft}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === "Enter") { commitHourDraft(); (e.target as HTMLInputElement).blur(); }
                  if (e.key === "ArrowUp") { e.preventDefault(); commit(h12 === 12 ? 1 : h12 + 1, m, period); }
                  if (e.key === "ArrowDown") { e.preventDefault(); commit(h12 === 1 ? 12 : h12 - 1, m, period); }
                }}
                aria-label="Jam"
                className="w-14 text-center text-2xl font-extrabold font-mono text-white tracking-tight bg-white/5 rounded-xl py-1 outline-none border border-transparent focus:border-violet-500/60 focus:bg-violet-500/10 transition-all"
              />
              <span className="text-2xl font-extrabold font-mono text-violet-400">:</span>
              <input
                type="text"
                inputMode="numeric"
                value={minuteDraft}
                onChange={e => setMinuteDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={commitMinuteDraft}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === "Enter") { commitMinuteDraft(); (e.target as HTMLInputElement).blur(); }
                  if (e.key === "ArrowUp") { e.preventDefault(); commit(h12, m === 59 ? 0 : m + 1, period); }
                  if (e.key === "ArrowDown") { e.preventDefault(); commit(h12, m === 0 ? 59 : m - 1, period); }
                }}
                aria-label="Menit"
                className="w-14 text-center text-2xl font-extrabold font-mono text-white tracking-tight bg-white/5 rounded-xl py-1 outline-none border border-transparent focus:border-teal-500/60 focus:bg-teal-500/10 transition-all"
              />
              <button
                type="button"
                onClick={() => commit(h12, m, period === "AM" ? "PM" : "AM")}
                className="ml-1.5 text-xs font-bold text-violet-300 self-start mt-1 px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
                title="Ganti AM/PM"
              >
                {period}
              </button>
            </div>

            <div className="flex gap-2">
              {/* Hour column */}
              <div className="flex-1">
                <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider text-center mb-1">Jam</p>
                <div className="grid grid-cols-3 gap-1">
                  {hours.map(hr => {
                    const active = hr === h12;
                    return (
                      <button
                        key={hr}
                        type="button"
                        onClick={() => commit(hr, m, period)}
                        className={`h-7 rounded-lg text-xs font-mono font-semibold transition-all ${
                          active
                            ? "bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-md shadow-violet-500/30 border border-violet-300/40"
                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {String(hr).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minute column */}
              <div className="flex-1">
                <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider text-center mb-1">Menit</p>
                <div className="grid grid-cols-3 gap-1">
                  {minutes.map(min => {
                    const active = min === m;
                    return (
                      <button
                        key={min}
                        type="button"
                        onClick={() => commit(h12, min, period)}
                        className={`h-7 rounded-lg text-xs font-mono font-semibold transition-all ${
                          active
                            ? "bg-gradient-to-tr from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/30 border border-teal-300/40"
                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {String(min).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AM/PM Toggle + fine minute stepper */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
              <div className="flex rounded-xl overflow-hidden border border-white/15 flex-1">
                {(["AM", "PM"] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => commit(h12, m, p)}
                    className={`flex-1 py-1.5 text-[11px] font-bold transition-all ${
                      period === p ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/70 bg-white/5"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepMinute(-1)}
                  className="w-7 h-7 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold border border-white/10"
                  title="-5 menit"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => stepMinute(1)}
                  className="w-7 h-7 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold border border-white/10"
                  title="+5 menit"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all"
              >
                OK
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}


// ─── Custom Currency & Number Input Component ─────────────────────────────────
function CurrencyNumberInput({
  label = "Jumlah Nominal (Rp)",
  value,
  onChange,
  placeholder = "0",
  currencySymbol = "Rp",
  quickAmounts = [10000, 50000, 100000, 500000, 1000000],
}: {
  label?: string;
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  currencySymbol?: string;
  quickAmounts?: number[];
}) {
  const numVal = typeof value === "number" ? value : parseFloat(value) || 0;

  const handleStep = (step: number) => {
    const current = typeof value === "number" ? value : parseFloat(value) || 0;
    const next = Math.max(0, current + step);
    onChange(String(next));
  };

  return (
    <div className="styled-number-input space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-white/40 text-[10px] uppercase font-semibold tracking-wider">{label}</label>
        {numVal > 0 && (
          <span className="text-violet-300 text-[10px] font-mono font-semibold">
            {currencySymbol} {numVal.toLocaleString("id-ID")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold font-mono select-none flex-shrink-0">
          {currencySymbol}
        </div>

        <input
          type="number"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-white font-extrabold text-xl font-mono outline-none px-2 py-0.5"
        />

        {/* Custom Styled Increment / Decrement Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleStep(-10000)}
            className="w-7 h-7 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-all border border-white/10"
            title="-10.000"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => handleStep(10000)}
            className="w-7 h-7 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-all border border-white/10"
            title="+10.000"
          >
            +
          </button>
        </div>
      </div>

      {/* Quick Amount Chips */}
      {quickAmounts.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-white/5">
          {quickAmounts.map((amt) => {
            const labelStr = amt >= 1000000 ? `+${amt / 1000000}Jt` : `+${amt / 1000}rb`;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  const current = typeof value === "number" ? value : parseFloat(value) || 0;
                  onChange(String(current + amt));
                }}
                className="px-2 py-0.5 rounded-md glass text-[10px] text-white/60 hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all font-mono"
              >
                {labelStr}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Tab Component ───────────────────────────────────────────────────
function DashboardTab({
  transactions,
  events,
  budget = [],
  currency,
  language = "ID",
  currentUser,
  onNavigate,
  onOpenOtherTools,
}: {
  transactions: Transaction[];
  events: ScheduleEvent[];
  budget?: BudgetItem[];
  currency: Currency;
  language?: Lang;
  currentUser?: User | null;
  onNavigate: (t: Tab) => void;
  onOpenOtherTools?: () => void;
}) {
  const [showBalance, setShowBalance] = useState(true);

  // Time-of-day greeting text & FontAwesome icon
  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) {
      return {
        text: language === "EN" ? "Good Morning" : "Selamat Pagi",
        icon: <i className="fa-solid fa-sun text-amber-400 ml-1.5" />,
      };
    }
    if (hour < 15) {
      return {
        text: language === "EN" ? "Good Afternoon" : "Selamat Siang",
        icon: <i className="fa-solid fa-sun text-amber-400 ml-1.5" />,
      };
    }
    if (hour < 18) {
      return {
        text: language === "EN" ? "Good Afternoon" : "Selamat Sore",
        icon: <i className="fa-solid fa-cloud-sun text-amber-400 ml-1.5" />,
      };
    }
    return {
      text: language === "EN" ? "Good Evening" : "Selamat Malam",
      icon: <i className="fa-solid fa-moon text-indigo-300 ml-1.5" />,
    };
  }, [language]);

  // Formatted currentDate label
  const dateFormatted = useMemo(() => {
    const d = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString(language === "EN" ? 'en-US' : 'id-ID', options);
  }, [language]);

  const totalIncome = useMemo(
    () => transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const totalExpense = useMemo(
    () => transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((balance / totalIncome) * 100)) : 0;

  // Expense by category calculation
  const expByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === "expense").forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [transactions]
  );

  const todayStr = getLocalDateStr();
  const upcomingSchedules = useMemo(
    () => events.filter(e => !e.done && e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    [events, todayStr]
  );

  // Budget summary calculations
  const totalBudgetLimit = useMemo(() => budget.reduce((sum, b) => sum + b.limit, 0), [budget]);
  const budgetUsagePct = totalBudgetLimit > 0 ? Math.min(100, Math.round((totalExpense / totalBudgetLimit) * 100)) : 0;

  return (
    <div className="tab-scroll h-full px-4 py-4 pb-24 space-y-4 animate-fade-in">
      {/* ── User Greeting Header ── */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-white font-extrabold text-lg tracking-tight flex items-center">
              {greetingData.text} {greetingData.icon}
            </h1>
            <span className="text-xs text-violet-300 font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30">
              {currentUser?.fullName?.split(" ")[0] || "User"}
            </span>
          </div>
          <p className="text-white/40 text-[11px] font-medium mt-0.5">{dateFormatted}</p>
        </div>

        {/* Profile Avatar Quick Button */}
        <button
          onClick={() => onNavigate("settings")}
          className="relative group p-[2px] rounded-full bg-gradient-to-tr from-violet-500 via-indigo-500 to-teal-400 shadow-lg shadow-violet-500/20 hover:scale-105 transition-transform"
          title="Ke Profil / Settings"
        >
          <div className="w-9 h-9 rounded-full bg-[#0d0f23] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="w-full h-full object-cover" />
            ) : (
              currentUser?.fullName?.charAt(0).toUpperCase() || <i className="fa-solid fa-user text-white/80" />
            )}
          </div>
        </button>
      </div>

      {/* ── Main Hero Balance Card ── */}
      <div
        className="relative rounded-3xl p-6 overflow-hidden shadow-2xl border border-white/20 transition-all duration-300"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.5) 0%, rgba(79,70,229,0.4) 50%, rgba(13,148,136,0.35) 100%)",
          backdropFilter: "blur(30px)",
        }}
      >
        {/* Glow ambient circle background */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-xs font-bold tracking-wider uppercase">
                {t("total_balance", language)}
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-white/50 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                title={showBalance ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
              >
                {showBalance ? (
                  <i className="fa-solid fa-eye text-xs text-violet-300" />
                ) : (
                  <i className="fa-solid fa-eye-slash text-xs text-white/40" />
                )}
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${balance >= 0 ? "bg-emerald-400 animate-pulse" : "bg-rose-400 animate-pulse"}`} />
              <span className="text-white/80 text-[10px] font-bold tracking-wide flex items-center gap-1">
                {balance >= 0 ? (
                  <>
                    <i className="fa-solid fa-circle-check text-emerald-400 text-[10px]" />
                    {language === "EN" ? "Healthy Flow" : "Cashflow Sehat"}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-circle-exclamation text-rose-400 text-[10px]" />
                    {language === "EN" ? "Deficit" : "Defisit"}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Amount Display */}
          <div>
            <p className="text-white font-extrabold tracking-tight" style={{ fontSize: 32, fontFamily: "'JetBrains Mono'" }}>
              {showBalance ? formatCurrency(balance, currency) : "••••••••••••"}
            </p>
          </div>

          {/* Income & Expense Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Income Card */}
            <div className="bg-white/10 rounded-2xl p-3 border border-white/15 backdrop-blur-md hover:bg-white/15 transition-all">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center text-[10px]">
                    <i className="fa-solid fa-arrow-trend-up" />
                  </span>
                  <span className="text-white/70 text-xs font-semibold">{t("income", language)}</span>
                </div>
              </div>
              <p className="text-emerald-300 font-bold text-sm font-mono">
                {showBalance ? formatShortCurrency(totalIncome, currency) : "••••••"}
              </p>
            </div>

            {/* Expense Card */}
            <div className="bg-white/10 rounded-2xl p-3 border border-white/15 backdrop-blur-md hover:bg-white/15 transition-all">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-rose-500/30 text-rose-300 flex items-center justify-center text-[10px]">
                    <i className="fa-solid fa-arrow-trend-down" />
                  </span>
                  <span className="text-white/70 text-xs font-semibold">{t("expense", language)}</span>
                </div>
              </div>
              <p className="text-rose-300 font-bold text-sm font-mono">
                {showBalance ? formatShortCurrency(totalExpense, currency) : "••••••"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Action Hub ── */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        <button
          onClick={() => onNavigate("transactions")}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl glass-card border border-violet-500/30 hover:border-violet-400 hover:bg-violet-600/20 active:scale-95 transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm sm:text-base shadow-md shadow-violet-600/30 group-hover:scale-110 transition-transform mb-1">
            <i className="fa-solid fa-plus" />
          </div>
          <span className="text-white text-[10px] sm:text-[11px] font-bold tracking-tight">Catat Tx</span>
        </button>

        <button
          onClick={() => onNavigate("budget")}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl glass-card border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-600/20 active:scale-95 transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center text-white text-sm sm:text-base shadow-md shadow-indigo-600/30 group-hover:scale-110 transition-transform mb-1">
            <i className="fa-solid fa-chart-pie" />
          </div>
          <span className="text-white text-[10px] sm:text-[11px] font-bold tracking-tight">Anggaran</span>
        </button>

        <button
          onClick={() => onNavigate("schedule")}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl glass-card border border-amber-500/30 hover:border-amber-400 hover:bg-amber-600/20 active:scale-95 transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm sm:text-base shadow-md shadow-amber-600/30 group-hover:scale-110 transition-transform mb-1">
            <i className="fa-solid fa-calendar-days" />
          </div>
          <span className="text-white text-[10px] sm:text-[11px] font-bold tracking-tight">Jadwal</span>
        </button>

        <button
          onClick={() => onNavigate("ai")}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl glass-card border border-teal-500/30 hover:border-teal-400 hover:bg-teal-600/20 active:scale-95 transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white text-sm sm:text-base shadow-md shadow-teal-600/30 group-hover:scale-110 transition-transform mb-1">
            <i className="fa-solid fa-wand-magic-sparkles" />
          </div>
          <span className="text-white text-[10px] sm:text-[11px] font-bold tracking-tight">AI Chat</span>
        </button>

        <button
          onClick={() => onOpenOtherTools && onOpenOtherTools()}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl glass-card border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-600/20 active:scale-95 transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm sm:text-base shadow-md shadow-emerald-600/30 group-hover:scale-110 transition-transform mb-1">
            <i className="fa-solid fa-toolbox" />
          </div>
          <span className="text-white text-[10px] sm:text-[11px] font-bold tracking-tight whitespace-nowrap">Tools Lain</span>
        </button>
      </div>

      {/* ── Financial Health & Quick Metrics ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Savings Rate Metric */}
        <div className="glass-card rounded-2xl p-3 text-center border border-white/10 hover:border-emerald-500/40 transition-all">
          <p className="font-extrabold text-base text-emerald-400 font-mono">{savingsRate}%</p>
          <p className="text-white/80 text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
            <i className="fa-solid fa-piggy-bank text-[11px] text-emerald-400" />
            {language === "EN" ? "Savings Rate" : "Rasio Hemat"}
          </p>
          <p className="text-white/40 text-[10px]">
            {savingsRate >= 30 ? (language === "EN" ? "Excellent" : "Sangat Baik") : (language === "EN" ? "Moderate" : "Cukup")}
          </p>
        </div>

        {/* Total Transactions Metric */}
        <div className="glass-card rounded-2xl p-3 text-center border border-white/10 hover:border-indigo-500/40 transition-all">
          <p className="font-extrabold text-base text-indigo-400 font-mono">{transactions.length}</p>
          <p className="text-white/80 text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
            <i className="fa-solid fa-receipt text-[11px] text-indigo-400" />
            {language === "EN" ? "Transactions" : "Transaksi"}
          </p>
          <p className="text-white/40 text-[10px]">{language === "EN" ? "recorded" : "tercatat"}</p>
        </div>

        {/* Budget Usage Metric */}
        <div className="glass-card rounded-2xl p-3 text-center border border-white/10 hover:border-amber-500/40 transition-all">
          <p className="font-extrabold text-base text-amber-400 font-mono">
            {totalBudgetLimit > 0 ? `${budgetUsagePct}%` : "0%"}
          </p>
          <p className="text-white/80 text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
            <i className="fa-solid fa-gauge-high text-[11px] text-amber-400" />
            {language === "EN" ? "Budget Limit" : "Batas Limit"}
          </p>
          <p className="text-white/40 text-[10px]">{language === "EN" ? "used" : "terpakai"}</p>
        </div>
      </div>

      {/* ── Upcoming Schedules Banner ── */}
      {upcomingSchedules.length > 0 && (
        <div className="glass-card rounded-2xl p-4 border border-amber-500/30 bg-gradient-to-r from-amber-950/20 to-orange-950/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-bell text-amber-400 text-sm" />
              <h3 className="text-amber-200 text-xs font-bold uppercase tracking-wider">
                {language === "EN" ? "Upcoming Agenda & Bills" : "Jadwal & Pengingat Terdekat"}
              </h3>
            </div>
            <button onClick={() => onNavigate("schedule")} className="text-amber-400 text-xs font-bold hover:underline flex items-center gap-1">
              {language === "EN" ? "View All" : "Lihat Semua"}
              <i className="fa-solid fa-chevron-right text-[10px]" />
            </button>
          </div>

          <div className="space-y-2">
            {upcomingSchedules.map(ev => (
              <div key={ev.id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5 border border-white/5 hover:border-white/15 transition-all">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: EVENT_COLORS[ev.type] }} />
                  <div className="truncate">
                    <span className="text-white text-xs font-semibold truncate block">{ev.title}</span>
                    {ev.note && <span className="text-white/40 text-[10px] truncate block">{ev.note}</span>}
                  </div>
                </div>
                <span className="text-amber-300 text-[11px] font-mono font-semibold flex-shrink-0 ml-2 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                  <i className="fa-regular fa-clock text-[10px]" />
                  {ev.date.slice(5).replace("-", "/")} • {ev.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expense by Category Breakdown ── */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
              <i className="fa-solid fa-chart-bar text-violet-400 text-xs" />
              {language === "EN" ? "Expense Breakdown" : "Pengeluaran per Kategori"}
            </h3>
            <p className="text-white/40 text-[10px]">
              {language === "EN" ? "Top 5 spending categories" : "5 Kategori pengeluaran terbesar"}
            </p>
          </div>
          <button onClick={() => onNavigate("budget")} className="text-violet-400 text-xs font-bold hover:underline flex items-center gap-1">
            {language === "EN" ? "Budget" : "Anggaran"}
            <i className="fa-solid fa-chevron-right text-[10px]" />
          </button>
        </div>

        {expByCategory.length === 0 ? (
          <div className="py-6 text-center text-white/30 text-xs italic bg-white/5 rounded-xl border border-white/5">
            {language === "EN" ? "No expense records yet" : "Belum ada catatan pengeluaran"}
          </div>
        ) : (
          <div className="space-y-3">
            {expByCategory.map(([cat, amount]) => {
              const info = DEFAULT_CATEGORIES[cat] || { icon: "fa-solid fa-shapes", color: "#64748b" };
              const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CategoryIcon icon={info.icon} className="text-xs text-white/80" />
                      <span className="text-white/90 font-semibold">{cat}</span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-white font-bold font-mono">
                        {showBalance ? formatShortCurrency(amount, currency) : "••••••"}
                      </span>
                      <span className="text-white/40 text-[10px] w-8 text-right font-mono">{pct}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: info.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Transactions Feed ── */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
              <i className="fa-solid fa-clock-rotate-left text-violet-400 text-xs" />
              {t("recent_transactions", language)}
            </h3>
            <p className="text-white/40 text-[10px]">
              {language === "EN" ? "Latest financial entries" : "Catatan aktivitas terbaru"}
            </p>
          </div>
          <button onClick={() => onNavigate("transactions")} className="text-violet-400 text-xs font-bold hover:underline flex items-center gap-1">
            {t("view_all", language)}
            <i className="fa-solid fa-chevron-right text-[10px]" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="py-8 text-center text-white/30 text-xs italic bg-white/5 rounded-xl border border-white/5 space-y-2">
            <p>{t("no_transactions", language)}</p>
            <button
              onClick={() => onNavigate("transactions")}
              className="px-3 py-1.5 rounded-xl bg-violet-600/30 text-violet-200 border border-violet-500/40 font-bold text-xs hover:bg-violet-600/50 transition-all inline-flex items-center gap-1.5"
            >
              <i className="fa-solid fa-plus text-xs" />
              {t("add_transaction", language)}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(tx => {
              const info = DEFAULT_CATEGORIES[tx.category] || { icon: "fa-solid fa-shapes", color: "#64748b" };
              return (
                <div key={tx.id} className="flex items-center gap-3 py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm flex-shrink-0 shadow-sm text-white"
                    style={{ background: `${info.color}25`, border: `1px solid ${info.color}55` }}
                  >
                    <CategoryIcon icon={info.icon} className="text-sm" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">{tx.note || tx.category}</p>
                    <p className="text-white/40 text-[11px] truncate">
                      {tx.category} • <span className="text-white/60">{tx.paymentMethod}</span> • {tx.date.slice(5).replace("-", "/")}
                    </p>
                  </div>

                  <p
                    className="font-extrabold text-xs flex-shrink-0 font-mono"
                    style={{
                      color: tx.type === "income" ? "#34d399" : "#f87171",
                    }}
                  >
                    {tx.type === "income" ? "+" : "-"}{showBalance ? formatShortCurrency(tx.amount, currency) : "••••••"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-6" />
    </div>
  );
}

// ─── Transactions Tab Component ────────────────────────────────────────────────
function TransactionsTab({
  transactions,
  currency,
  language = "ID",
  onAdd,
  onUpdate,
  onDelete,
  onShowToast,
}: {
  transactions: Transaction[];
  currency: Currency;
  language?: Lang;
  onAdd: (tx: Omit<Transaction, "id">) => void;
  onUpdate?: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onShowToast: (msg: string, type: "success" | "info" | "alert") => void;
}) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "this_month" | "7days">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [showForm, setShowForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: "expense" as TxType,
    amount: "",
    category: "Makanan",
    note: "",
    date: getLocalDateStr(),
    paymentMethod: "Tunai",
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const targetTx = useMemo(() => transactions.find(t => t.id === deleteConfirmId), [transactions, deleteConfirmId]);

  // Handle opening form for editing
  const handleStartEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setForm({
      type: tx.type,
      amount: tx.amount.toString(),
      category: tx.category,
      note: tx.note,
      date: tx.date,
      paymentMethod: tx.paymentMethod,
    });
    setShowForm(true);
  };

  // Close form and reset edit state
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTxId(null);
    setForm({ type: "expense", amount: "", category: "Makanan", note: "", date: getLocalDateStr(), paymentMethod: "Tunai" });
  };

  // Filtered & Sorted Transactions calculation
  const filtered = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const sevenDaysAgoStr = getLocalDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    return transactions
      .filter(t => (filter === "all" ? true : t.type === filter))
      .filter(t => (selectedCategory === "all" ? true : t.category === selectedCategory))
      .filter(t => {
        if (dateRange === "this_month") {
          const [y, m] = t.date.split("-").map(Number);
          return y === currentYear && m === currentMonth + 1;
        }
        if (dateRange === "7days") {
          return t.date >= sevenDaysAgoStr;
        }
        return true;
      })
      .filter(t =>
        searchTerm
          ? t.note.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
          : true
      )
      .sort((a, b) => {
        if (sortBy === "date_desc") return b.date.localeCompare(a.date);
        if (sortBy === "date_asc") return a.date.localeCompare(b.date);
        if (sortBy === "amount_desc") return b.amount - a.amount;
        if (sortBy === "amount_asc") return a.amount - b.amount;
        return 0;
      });
  }, [transactions, filter, selectedCategory, dateRange, searchTerm, sortBy]);

  // Metrics calculation for the filtered view
  const metrics = useMemo(() => {
    const income = filtered.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const handleSubmit = () => {
    if (!form.amount || !form.note.trim()) {
      onShowToast(language === "EN" ? "Please fill amount and description" : "Mohon isi jumlah nominal dan catatan transaksi", "alert");
      return;
    }
    const val = parseInt(form.amount, 10);
    if (isNaN(val) || val <= 0) {
      onShowToast(language === "EN" ? "Amount must be a positive number" : "Jumlah transaksi harus berupa angka positif", "alert");
      return;
    }

    if (editingTxId) {
      if (onUpdate) {
        onUpdate({
          id: editingTxId,
          ...form,
          amount: val,
        });
        onShowToast(language === "EN" ? "Transaction updated successfully!" : "Transaksi berhasil diperbarui!", "success");
      }
    } else {
      onAdd({
        ...form,
        amount: val,
      });
      onShowToast(
        language === "EN"
          ? `${form.type === "income" ? "Income" : "Expense"} transaction added!`
          : `Transaksi ${form.type === "income" ? "pemasukan" : "pengeluaran"} berhasil ditambahkan!`,
        "success"
      );
    }
    handleCloseForm();
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      onShowToast(language === "EN" ? "No transactions to export" : "Belum ada transaksi untuk diekspor", "alert");
      return;
    }
    const headers = "ID,Tipe,Jumlah,Kategori,Catatan,Tanggal,Metode Pembayaran\n";
    const rows = transactions
      .map(t => `"${t.id}","${t.type}",${t.amount},"${t.category}","${t.note.replace(/"/g, '""')}","${t.date}","${t.paymentMethod}"`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-keuangan-${getLocalDateStr()}.csv`;
    a.click();
    onShowToast(language === "EN" ? "Exported to CSV successfully" : "Data transaksi berhasil diekspor ke CSV", "success");
  };

  const incomeCategories = ["Gaji", "Freelance", "Investasi", "Lainnya"];
  const expenseCategories = ["Makanan", "Transport", "Belanja", "Hiburan", "Kesehatan", "Pendidikan", "Utilitas", "Lainnya"];
  const cats = form.type === "income" ? incomeCategories : expenseCategories;
  const paymentMethods = ["Tunai", "BCA Bank", "Mandiri", "GoPay", "OVO", "ShopeePay", "Kartu Kredit", "Reksadana"];
  const allAvailableCategories = Array.from(new Set([...incomeCategories, ...expenseCategories]));

  return (
    <div className="tab-scroll h-full px-4 py-4 space-y-4 animate-fade-in">
      {/* Header & Main Action Hub */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-extrabold text-lg flex items-center gap-2">
            <i className="fa-solid fa-arrow-left-right text-violet-400 text-base" />
            {language === "EN" ? "Manage Transactions" : "Kelola Transaksi"}
          </h2>
          <p className="text-white/40 text-xs">
            {language === "EN" ? "Income & Expense Records" : "Catatan Pemasukan & Pengeluaran"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 glass rounded-xl text-white/80 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 border border-white/10 hover:border-emerald-500/40 active:scale-95"
            title="Ekspor CSV"
          >
            <i className="fa-solid fa-file-csv text-emerald-400 text-sm" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={() => (showForm ? handleCloseForm() : setShowForm(true))}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all active:scale-95 border border-violet-400/40"
            style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}
          >
            <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"} text-xs`} />
            <span>{showForm ? (language === "EN" ? "Close" : "Tutup") : (language === "EN" ? "Add New" : "Catat Tx")}</span>
          </button>
        </div>
      </div>

      {/* Filtered View Summary Metrics Bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-2xl p-2.5 border border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
            <i className="fa-solid fa-circle-arrow-down" />
            <span>{language === "EN" ? "Income" : "Pemasukan"}</span>
          </div>
          <p className="text-emerald-300 font-extrabold text-xs sm:text-sm font-mono truncate">
            +{formatShortCurrency(metrics.income, currency)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-2.5 border border-rose-500/20 bg-rose-950/10">
          <div className="flex items-center gap-1.5 text-rose-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
            <i className="fa-solid fa-circle-arrow-up" />
            <span>{language === "EN" ? "Expense" : "Pengeluaran"}</span>
          </div>
          <p className="text-rose-300 font-extrabold text-xs sm:text-sm font-mono truncate">
            -{formatShortCurrency(metrics.expense, currency)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-2.5 border border-indigo-500/20 bg-indigo-950/10">
          <div className="flex items-center gap-1.5 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-0.5">
            <i className="fa-solid fa-scale-balanced" />
            <span>{language === "EN" ? "Net Flow" : "Selisih"}</span>
          </div>
          <p className={`font-extrabold text-xs sm:text-sm font-mono truncate ${metrics.net >= 0 ? "text-indigo-300" : "text-amber-400"}`}>
            {metrics.net >= 0 ? "+" : ""}{formatShortCurrency(metrics.net, currency)}
          </p>
        </div>
      </div>

      {/* Add / Edit Transaction Form Panel */}
      {showForm && (
        <div className="glass-strong rounded-2xl p-4 space-y-3.5 border border-violet-500/30 animate-slide-up shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <p className="text-white text-xs font-extrabold uppercase tracking-wider text-violet-300 flex items-center gap-2">
              <i className={`fa-solid ${editingTxId ? "fa-pen-to-square" : "fa-circle-plus"} text-sm text-violet-400`} />
              {editingTxId
                ? (language === "EN" ? "Edit Transaction" : "Edit Catatan Transaksi")
                : (language === "EN" ? "Record New Transaction" : "Catat Transaksi Baru")}
            </p>
            <button onClick={handleCloseForm} className="text-white/40 hover:text-white text-xs p-1">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Type Switcher Buttons */}
          <div className="flex rounded-xl overflow-hidden p-1 bg-white/5 border border-white/10">
            {(["income", "expense"] as TxType[]).map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t, category: t === "income" ? "Gaji" : "Makanan" }))}
                className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                style={{
                  background:
                    form.type === t
                      ? t === "income"
                        ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                        : "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)"
                      : "transparent",
                  color: form.type === t ? "#fff" : "rgba(255,255,255,0.4)",
                  boxShadow: form.type === t ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                }}
              >
                <i className={`fa-solid ${t === "income" ? "fa-arrow-trend-up" : "fa-arrow-trend-down"} text-xs`} />
                <span>{t === "income" ? (language === "EN" ? "Income" : "Pemasukan") : (language === "EN" ? "Expense" : "Pengeluaran")}</span>
              </button>
            ))}
          </div>

          {/* Custom Styled Amount Input */}
          <CurrencyNumberInput
            label={language === "EN" ? "Amount Nominal (Rp)" : "Jumlah Nominal (Rp)"}
            value={form.amount}
            onChange={val => setForm(f => ({ ...f, amount: val }))}
            placeholder="0"
          />

          {/* Note Input */}
          <div className="glass rounded-xl px-3.5 py-2 border border-white/10 focus-within:border-violet-500/50 transition-all">
            <label className="text-white/40 text-[10px] uppercase font-semibold block mb-0.5">
              {language === "EN" ? "Description / Note" : "Deskripsi / Catatan"}
            </label>
            <input
              type="text"
              placeholder={language === "EN" ? "e.g. Weekly grocery shopping..." : "Contoh: Belanja bahan makanan mingguan..."}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full bg-transparent text-white text-xs focus:outline-none"
            />
          </div>

          {/* Category Selection Grid */}
          <div>
            <label className="text-white/40 text-[10px] uppercase font-semibold block mb-1.5 ml-1">
              {language === "EN" ? "Category" : "Kategori"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {cats.map(c => {
                const info = DEFAULT_CATEGORIES[c] || { icon: "fa-solid fa-shapes", color: "#64748b" };
                const isSelected = form.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: c }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: isSelected ? `${info.color}35` : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isSelected ? info.color : "rgba(255,255,255,0.1)"}`,
                      color: isSelected ? "#fff" : "rgba(255,255,255,0.6)",
                      boxShadow: isSelected ? `0 0 12px ${info.color}40` : "none",
                    }}
                  >
                    <CategoryIcon icon={info.icon} className="text-xs" />
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method & Date Inputs */}
          <div className="grid grid-cols-2 gap-2 relative z-20">
            <div className="glass rounded-xl px-3 py-2 border border-white/10 relative z-30">
              <label className="text-white/40 text-[10px] uppercase font-semibold block mb-1">
                {language === "EN" ? "Payment Method" : "Metode Pembayaran"}
              </label>
              <CustomDropdown
                value={form.paymentMethod}
                options={paymentMethods.map(pm => ({ value: pm, label: pm }))}
                onChange={val => setForm(f => ({ ...f, paymentMethod: val }))}
                className="w-full"
              />
            </div>

            <div className="glass rounded-xl px-3 py-2 border border-white/10">
              <label className="text-white/40 text-[10px] uppercase font-semibold block mb-1">
                {language === "EN" ? "Date" : "Tanggal"}
              </label>
              <CustomDatePicker
                value={form.date}
                onChange={dateStr => setForm(f => ({ ...f, date: dateStr }))}
                className="w-full"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-violet-600/30 active:scale-[0.98] border border-violet-400/30 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
          >
            <i className={`fa-solid ${editingTxId ? "fa-floppy-disk" : "fa-check"} text-sm`} />
            <span>{editingTxId ? (language === "EN" ? "Save Changes" : "Simpan Perubahan") : (language === "EN" ? "Save Transaction" : "Simpan Transaksi")}</span>
          </button>
        </div>
      )}

      {/* Advanced Multi-Filter & Search Toolbar */}
      <div className="glass-card rounded-2xl p-3 space-y-2.5 border border-white/10">
        {/* Search Input Bar */}
        <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 border border-white/10 focus-within:border-violet-500/50 transition-all">
          <i className="fa-solid fa-magnifying-glass text-white/40 text-xs" />
          <input
            type="text"
            placeholder={language === "EN" ? "Search transactions, notes, payment..." : "Cari transaksi, catatan, metode..."}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-white text-xs focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="text-white/40 hover:text-white text-xs">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>

        {/* Type Filter Buttons */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {(["all", "income", "expense"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 active:scale-95"
              style={{
                background: filter === f ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${filter === f ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: filter === f ? "#c084fc" : "rgba(255,255,255,0.5)",
              }}
            >
              <i
                className={`fa-solid ${
                  f === "all" ? "fa-border-all" : f === "income" ? "fa-arrow-trend-up text-emerald-400" : "fa-arrow-trend-down text-rose-400"
                } text-[11px]`}
              />
              <span>
                {f === "all"
                  ? language === "EN" ? "All Types" : "Semua Tipe"
                  : f === "income"
                  ? language === "EN" ? "Income" : "Pemasukan"
                  : language === "EN" ? "Expense" : "Pengeluaran"}
              </span>
            </button>
          ))}
        </div>

        {/* Category, Date Range, & Sorting Custom Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-white/5 relative z-30">
          {/* Category Filter */}
          <div className="glass rounded-xl px-2.5 py-1.5 border border-white/10">
            <label className="text-white/40 text-[9px] uppercase font-bold block mb-1">
              <i className="fa-solid fa-filter text-[9px] mr-1 text-violet-400" />
              {language === "EN" ? "Category" : "Kategori"}
            </label>
            <CustomDropdown
              value={selectedCategory}
              options={[
                { value: "all", label: language === "EN" ? "All Categories" : "Semua Kategori" },
                ...allAvailableCategories.map(cat => {
                  const catInfo = DEFAULT_CATEGORIES[cat];
                  return {
                    value: cat,
                    label: cat,
                    icon: catInfo ? <CategoryIcon icon={catInfo.icon} className="text-xs mr-0.5" /> : undefined,
                  };
                }),
              ]}
              onChange={val => setSelectedCategory(val)}
              className="w-full"
            />
          </div>

          {/* Date Range Filter */}
          <div className="glass rounded-xl px-2.5 py-1.5 border border-white/10">
            <label className="text-white/40 text-[9px] uppercase font-bold block mb-1">
              <i className="fa-regular fa-calendar-days text-[9px] mr-1 text-violet-400" />
              {language === "EN" ? "Period" : "Periode"}
            </label>
            <CustomDropdown
              value={dateRange}
              options={[
                { value: "all", label: language === "EN" ? "All Time" : "Semua Waktu" },
                { value: "this_month", label: language === "EN" ? "This Month" : "Bulan Ini" },
                { value: "7days", label: language === "EN" ? "Last 7 Days" : "7 Hari Terakhir" },
              ]}
              onChange={val => setDateRange(val as any)}
              className="w-full"
            />
          </div>

          {/* Sorting Control */}
          <div className="glass rounded-xl px-2.5 py-1.5 border border-white/10">
            <label className="text-white/40 text-[9px] uppercase font-bold block mb-1">
              <i className="fa-solid fa-arrow-down-wide-short text-[9px] mr-1 text-violet-400" />
              {language === "EN" ? "Sort By" : "Urutkan"}
            </label>
            <CustomDropdown
              value={sortBy}
              options={[
                { value: "date_desc", label: language === "EN" ? "Newest First" : "Tanggal Terbaru" },
                { value: "date_asc", label: language === "EN" ? "Oldest First" : "Tanggal Terlama" },
                { value: "amount_desc", label: language === "EN" ? "Highest Amount" : "Nominal Terbesar" },
                { value: "amount_asc", label: language === "EN" ? "Lowest Amount" : "Nominal Terkecil" },
              ]}
              onChange={val => setSortBy(val as any)}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Transactions List Feed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-white/40 text-xs font-semibold">
            {language === "EN" ? `Showing ${filtered.length} entries` : `Menampilkan ${filtered.length} transaksi`}
          </p>
          {(searchTerm || selectedCategory !== "all" || filter !== "all" || dateRange !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setFilter("all");
                setDateRange("all");
              }}
              className="text-violet-400 hover:text-violet-300 text-xs font-bold hover:underline flex items-center gap-1"
            >
              <i className="fa-solid fa-rotate-left text-[10px]" />
              {language === "EN" ? "Reset Filters" : "Reset Filter"}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center border border-white/10 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-2xl text-white/30 shadow-inner">
              <i className="fa-solid fa-receipt" />
            </div>
            <div>
              <p className="text-white/80 text-xs font-extrabold">
                {language === "EN" ? "No transactions found" : "Tidak ada transaksi ditemukan"}
              </p>
              <p className="text-white/40 text-[11px] mt-0.5">
                {language === "EN"
                  ? "Try adjusting search keywords or active filters"
                  : "Coba ubah kata kunci pencarian atau sesuaikan filter"}
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-3.5 py-1.5 rounded-xl bg-violet-600/30 text-violet-200 border border-violet-500/40 font-bold text-xs hover:bg-violet-600/50 transition-all inline-flex items-center gap-1.5 active:scale-95"
            >
              <i className="fa-solid fa-plus text-xs" />
              {language === "EN" ? "Record Transaction" : "Catat Transaksi Pertama"}
            </button>
          </div>
        ) : (
          filtered.map(tx => {
            const info = DEFAULT_CATEGORIES[tx.category] || { icon: "fa-solid fa-shapes", color: "#64748b" };
            return (
              <div
                key={tx.id}
                className="glass-card rounded-2xl p-3 flex items-center gap-3 border border-white/10 hover:border-white/20 transition-all group"
              >
                {/* Category Icon Badge */}
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 shadow-md transition-transform group-hover:scale-105 text-white"
                  style={{ background: `${info.color}25`, border: `1px solid ${info.color}55` }}
                >
                  <CategoryIcon icon={info.icon} className="text-base" />
                </div>

                {/* Main Transaction Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-xs font-extrabold truncate">{tx.note || tx.category}</p>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-white/60 font-mono flex-shrink-0">
                      {tx.paymentMethod}
                    </span>
                  </div>
                  <p className="text-white/40 text-[11px] truncate mt-0.5">
                    {tx.category} • <span className="font-mono">{tx.date.slice(5).replace("-", "/")}</span>
                  </p>
                </div>

                {/* Amount & Actions */}
                <div className="text-right flex-shrink-0 space-y-1">
                  <p
                    className="font-extrabold text-xs font-mono"
                    style={{ color: tx.type === "income" ? "#34d399" : "#f87171" }}
                  >
                    {tx.type === "income" ? "+" : "-"}{formatShortCurrency(tx.amount, currency)}
                  </p>
                  
                  {/* Quick Edit & Delete Actions */}
                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      onClick={() => handleStartEdit(tx)}
                      className="text-white/40 hover:text-violet-300 text-[11px] transition-colors p-0.5"
                      title="Edit Transaksi"
                    >
                      <i className="fa-solid fa-pen-to-square" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(tx.id)}
                      className="text-white/30 hover:text-rose-400 text-[11px] transition-colors p-0.5"
                      title="Hapus Transaksi"
                    >
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={language === "EN" ? "Delete Transaction" : "Hapus Transaksi"}
        message={
          targetTx
            ? language === "EN"
              ? `Are you sure you want to delete "${targetTx.note}" worth ${formatShortCurrency(targetTx.amount, currency)}? This action cannot be undone.`
              : `Apakah Anda yakin ingin menghapus transaksi "${targetTx.note}" senilai ${formatShortCurrency(targetTx.amount, currency)}? Data yang dihapus tidak dapat dikembalikan.`
            : language === "EN"
            ? "Are you sure you want to delete this transaction?"
            : "Apakah Anda yakin ingin menghapus transaksi ini?"
        }
        confirmText={language === "EN" ? "Yes, Delete" : "Ya, Hapus"}
        cancelText={language === "EN" ? "Cancel" : "Batal"}
        onConfirm={() => {
          if (deleteConfirmId) {
            onDelete(deleteConfirmId);
            onShowToast(language === "EN" ? "Transaction deleted" : "Transaksi berhasil dihapus", "info");
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <div className="h-6" />
    </div>
  );
}

// ─── Budget Tab Component ─────────────────────────────────────────────────────
function BudgetTab({
  budget,
  transactions,
  currency,
  language = "ID",
  onUpdateLimit,
  onAddBudget,
  onDeleteBudget,
  onShowToast,
}: {
  budget: BudgetItem[];
  transactions: Transaction[];
  currency: Currency;
  language?: Lang;
  onUpdateLimit: (id: string, limit: number) => void;
  onAddBudget: (b: Omit<BudgetItem, "id">) => void;
  onDeleteBudget?: (id: string) => void;
  onShowToast: (msg: string, type: "success" | "info" | "alert") => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState("Makanan");
  const [newLimit, setNewLimit] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.type === "expense")
      .forEach(t => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });
    return map;
  }, [transactions]);

  const totalBudget = useMemo(() => budget.reduce((s, b) => s + b.limit, 0), [budget]);
  const totalSpent = useMemo(() => budget.reduce((s, b) => s + (spendByCategory[b.category] || 0), 0), [budget, spendByCategory]);
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const now = new Date();
  const daysInCurrentMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
  const remainingDays = Math.max(1, daysInCurrentMonth - now.getDate() + 1);
  const remainingBudget = Math.max(0, totalBudget - totalSpent);
  const dailyAllowance = Math.round(remainingBudget / remainingDays);

  // Find top spending category
  const topSpentCategory = useMemo(() => {
    let topCat = "";
    let maxAmt = 0;
    Object.entries(spendByCategory).forEach(([cat, amt]) => {
      if (amt > maxAmt) {
        maxAmt = amt;
        topCat = cat;
      }
    });
    return { category: topCat, amount: maxAmt };
  }, [spendByCategory]);

  const handleCreateBudget = () => {
    if (!newLimit) return;
    const limitNum = parseInt(newLimit, 10);
    if (isNaN(limitNum) || limitNum <= 0) return;

    // Check duplicate category
    const existing = budget.find(b => b.category.toLowerCase() === newCategory.toLowerCase());
    if (existing) {
      onShowToast(
        language === "EN"
          ? `Budget limit for ${newCategory} already exists`
          : `Batas anggaran untuk ${newCategory} sudah ada. Silakan edit dari daftar.`,
        "alert"
      );
      return;
    }

    const info = DEFAULT_CATEGORIES[newCategory] || { icon: "fa-solid fa-shapes", color: "#64748b" };
    onAddBudget({
      category: newCategory,
      limit: limitNum,
      icon: info.icon,
      color: info.color,
    });
    onShowToast(
      language === "EN"
        ? `Budget limit created for ${newCategory}`
        : `Batas anggaran untuk ${newCategory} telah dibuat`,
      "success"
    );
    setNewLimit("");
    setShowAddForm(false);
  };

  const targetDeleteBudget = budget.find(b => b.id === deleteConfirmId);

  return (
    <div className="tab-scroll h-full px-4 py-4 space-y-4 animate-fade-in">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-extrabold text-lg flex items-center gap-2">
            <i className="fa-solid fa-chart-pie text-violet-400 text-base" />
            <span>{language === "EN" ? "Monthly Budget" : "Anggaran Bulanan"}</span>
          </h2>
          <p className="text-white/40 text-xs">
            {language === "EN" ? "Expense Limits & Allocations" : "Batas & Alokasi Pengeluaran"}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-2 glass rounded-xl text-violet-300 text-xs font-extrabold hover:bg-white/10 transition-all border border-violet-500/30 flex items-center gap-1.5 active:scale-95 shadow-md"
        >
          <i className={`fa-solid ${showAddForm ? "fa-xmark" : "fa-plus"} text-xs`} />
          <span>{showAddForm ? (language === "EN" ? "Cancel" : "Batal") : (language === "EN" ? "Add Limit" : "Tambah Batas")}</span>
        </button>
      </div>

      {/* Hero Overview Summary Card */}
      <div
        className="rounded-2xl p-5 glow-violet relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.25) 100%)",
          border: "1px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex justify-between items-start mb-3.5">
          <div>
            <p className="text-white/60 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
              <i className="fa-solid fa-wallet text-violet-300 text-[10px]" />
              {language === "EN" ? "Total Budget Limit" : "Total Batas Anggaran"}
            </p>
            <p className="text-white font-extrabold text-2xl mt-0.5" style={{ fontFamily: "'JetBrains Mono'" }}>
              {formatCurrency(totalBudget, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-[10px] uppercase font-bold tracking-wider">
              {language === "EN" ? "Usage Status" : "Status Penggunaan"}
            </p>
            <p
              className="font-extrabold text-xl mt-0.5"
              style={{ color: overallPct > 90 ? "#f87171" : overallPct > 75 ? "#fb923c" : "#34d399", fontFamily: "'JetBrains Mono'" }}
            >
              {overallPct}%
            </p>
          </div>
        </div>

        {/* Multi-tier Progress Bar */}
        <div className="progress-bar" style={{ height: 9 }}>
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(overallPct, 100)}%`,
              background:
                overallPct > 90
                  ? "linear-gradient(90deg, #f97316, #ef4444)"
                  : overallPct > 75
                  ? "linear-gradient(90deg, #6366f1, #f59e0b)"
                  : "linear-gradient(90deg, #6366f1, #8b5cf6)",
            }}
          />
        </div>

        <div className="flex justify-between items-center mt-3 text-xs">
          <span className="text-white/70 font-medium flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono'" }}>
            <i className="fa-solid fa-circle-arrow-up text-rose-400 text-[10px]" />
            {language === "EN" ? "Used" : "Terpakai"}: {formatShortCurrency(totalSpent, currency)}
          </span>
          <span className="text-emerald-300 font-bold flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono'" }}>
            <i className="fa-solid fa-piggy-bank text-emerald-400 text-[10px]" />
            {language === "EN" ? "Remaining" : "Sisa"}: {formatShortCurrency(remainingBudget, currency)}
          </span>
        </div>
      </div>

      {/* Smart Daily Financial Planner Card */}
      <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3.5 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0 border border-amber-500/30">
          <i className="fa-solid fa-lightbulb text-base" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-white text-xs font-bold">
              {language === "EN" ? "Daily Allowance Recommendation" : "Rekomendasi Batas Harian"}
            </p>
            {topSpentCategory.category && (
              <span className="chip bg-white/10 text-white/70 text-[9px] px-1.5 py-0.5">
                Top: {topSpentCategory.category}
              </span>
            )}
          </div>
          <p className="text-white/60 text-[11px] mt-0.5">
            {language === "EN" ? `Remaining ${remainingDays} days this month: ` : `Sisa ${remainingDays} hari bulan ini: `}
            <span className="text-amber-300 font-extrabold font-mono">{formatShortCurrency(dailyAllowance, currency)}</span>
            {language === "EN" ? "/day" : "/hari"}
          </p>
        </div>
      </div>

      {/* Add Budget Form Modal / Panel */}
      {showAddForm && (
        <div className="glass-strong rounded-2xl p-4 space-y-3.5 border border-violet-500/30 animate-slide-up shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <p className="text-white text-xs font-extrabold uppercase tracking-wider text-violet-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-plus text-sm text-violet-400" />
              <span>{language === "EN" ? "Set New Category Limit" : "Set Batas Kategori Baru"}</span>
            </p>
            <button onClick={() => setShowAddForm(false)} className="text-white/40 hover:text-white text-xs p-1">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Category Selector */}
          <div className="glass rounded-xl px-3 py-2 relative z-20">
            <label className="text-white/40 text-[10px] block mb-1 uppercase font-semibold tracking-wider">
              <i className="fa-solid fa-shapes text-[10px] mr-1 text-violet-400" />
              {language === "EN" ? "Category" : "Kategori"}
            </label>
            <CustomDropdown
              value={newCategory}
              options={Object.entries(DEFAULT_CATEGORIES).map(([cat, info]) => ({
                value: cat,
                label: cat,
                icon: <CategoryIcon icon={info.icon} className="text-xs mr-0.5" />,
              }))}
              onChange={val => setNewCategory(val)}
              className="w-full"
            />
          </div>

          {/* Styled Budget Limit Input */}
          <CurrencyNumberInput
            label={language === "EN" ? "Budget Limit (Rp)" : "Batas Anggaran (Rp)"}
            value={newLimit}
            onChange={setNewLimit}
            placeholder="0"
            quickAmounts={[500000, 1000000, 1500000, 2000000, 5000000]}
          />

          <button
            onClick={handleCreateBudget}
            className="w-full py-3 rounded-xl text-white text-xs font-extrabold tracking-wider uppercase transition-all shadow-lg shadow-violet-600/30 active:scale-[0.98] border border-violet-400/30 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
          >
            <i className="fa-solid fa-check text-sm" />
            <span>{language === "EN" ? "Save Budget Limit" : "Simpan Batas Anggaran"}</span>
          </button>
        </div>
      )}

      {/* Budget Category Item List */}
      <div className="space-y-3">
        {budget.map(b => {
          const spent = spendByCategory[b.category] || 0;
          const pct = b.limit > 0 ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
          const isOver = spent > b.limit;
          const isWarning = pct >= 80 && !isOver;
          const isEditing = editingId === b.id;

          return (
            <div key={b.id} className="glass-card rounded-2xl p-4 transition-all hover:border-white/20">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                {/* Left: Category Icon & Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${b.color}22`, border: `1px solid ${b.color}44`, color: b.color }}
                  >
                    <CategoryIcon icon={b.icon} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-white font-extrabold text-xs truncate">{b.category}</span>
                      {isOver && (
                        <span className="chip bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 text-[10px] px-1.5 py-0.5">
                          <i className="fa-solid fa-triangle-exclamation text-[9px]" />
                          {language === "EN" ? "Over Limit" : "Melebihi"}
                        </span>
                      )}
                      {isWarning && (
                        <span className="chip bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 text-[10px] px-1.5 py-0.5">
                          <i className="fa-solid fa-triangle-exclamation text-[9px]" />
                          {language === "EN" ? "Warning" : "Hati-hati"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-white/50 text-[11px]" style={{ fontFamily: "'JetBrains Mono'" }}>
                        {formatShortCurrency(spent, currency)} /
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1 bg-white/5 border border-violet-500/50 rounded-lg px-2 py-0.5">
                          <span className="text-violet-400 text-[10px] font-bold font-mono select-none flex-shrink-0">Rp</span>
                          <input
                            type="number"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            className="w-24 bg-transparent text-white text-xs font-mono focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              const val = parseInt(editVal, 10);
                              if (!isNaN(val) && val > 0) {
                                onUpdateLimit(b.id, val);
                                onShowToast(
                                  language === "EN" ? `Budget limit for ${b.category} updated` : `Batas ${b.category} diperbarui`,
                                  "success"
                                );
                              }
                              setEditingId(null);
                            }}
                            className="text-emerald-400 hover:text-emerald-300 text-xs font-bold px-1 transition-colors"
                          >
                            <i className="fa-solid fa-check" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-white/40 hover:text-white text-xs px-0.5 transition-colors"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(b.id);
                            setEditVal(String(b.limit));
                          }}
                          className="text-violet-300 text-[11px] font-mono hover:underline flex items-center gap-1"
                        >
                          <span>{formatShortCurrency(b.limit, currency)}</span>
                          <i className="fa-solid fa-pen-to-square text-[10px] text-violet-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Aligned Percentage & Delete Button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="font-extrabold text-xs px-2 py-1 rounded-xl bg-white/5 border border-white/10"
                    style={{ color: isOver ? "#f87171" : isWarning ? "#fb923c" : "#34d399", fontFamily: "'JetBrains Mono'" }}
                  >
                    {pct}%
                  </span>
                  {onDeleteBudget && (
                    <button
                      onClick={() => setDeleteConfirmId(b.id)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-white/5 hover:border-rose-500/20 active:scale-95"
                      title={language === "EN" ? "Delete Budget" : "Hapus Batas"}
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Progress Bar */}
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: isOver
                      ? "linear-gradient(90deg, #f97316, #ef4444)"
                      : isWarning
                      ? "linear-gradient(90deg, #6366f1, #f59e0b)"
                      : b.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Budget Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={language === "EN" ? "Delete Budget Limit" : "Hapus Batas Anggaran"}
        message={
          targetDeleteBudget
            ? language === "EN"
              ? `Are you sure you want to remove the budget limit for "${targetDeleteBudget.category}"?`
              : `Apakah Anda yakin ingin menghapus batas anggaran untuk kategori "${targetDeleteBudget.category}"?`
            : language === "EN"
            ? "Are you sure you want to delete this budget limit?"
            : "Apakah Anda yakin ingin menghapus batas anggaran ini?"
        }
        confirmText={language === "EN" ? "Yes, Delete" : "Ya, Hapus"}
        cancelText={language === "EN" ? "Cancel" : "Batal"}
        onConfirm={() => {
          if (deleteConfirmId && onDeleteBudget) {
            onDeleteBudget(deleteConfirmId);
            onShowToast(language === "EN" ? "Budget limit deleted" : "Batas anggaran telah dihapus", "info");
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <div className="h-6" />
    </div>
  );
}

// ─── Schedule Tab Component ───────────────────────────────────────────────────
function ScheduleTab({
  events,
  language = "ID",
  onAdd,
  onToggle,
  onDelete,
  onShowToast,
}: {
  events: ScheduleEvent[];
  language?: Lang;
  onAdd: (ev: Omit<ScheduleEvent, "id">) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onShowToast: (msg: string, type: "success" | "info" | "alert") => void;
}) {
  // Keep "today" reactive so the calendar auto-syncs when the real date rolls over
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setToday(new Date());
    const interval = setInterval(tick, 60_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  const todayStr = getLocalDateStr(today);

  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(getLocalDateStr(today));
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const [form, setForm] = useState({
    title: "",
    date: selectedDate,
    time: "09:00",
    type: "task" as ScheduleEvent["type"],
    recurring: "none" as RecurringRule,
    note: "",
    done: false,
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const targetEvent = useMemo(() => events.find(e => e.id === deleteConfirmId), [events, deleteConfirmId]);

  const monthNamesID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const monthNamesEN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNames = language === "EN" ? monthNamesEN : monthNamesID;

  const dayNamesID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayNamesEN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNames = language === "EN" ? dayNamesEN : dayNamesID;

  const days = getDaysInMonth(viewDate.year, viewDate.month);
  const firstDay = getFirstDayOfMonth(viewDate.year, viewDate.month);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const daysArr = Array.from({ length: days }, (_, i) => i + 1);

  const formatDS = (d: number) =>
    `${viewDate.year}-${String(viewDate.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const eventsOnDate = (d: number) => events.filter(e => e.date === formatDS(d));

  // Analytics Stats for Schedule
  const totalEventsCount = events.length;
  const pendingEventsCount = useMemo(() => events.filter(e => !e.done).length, [events]);
  const completedEventsCount = useMemo(() => events.filter(e => e.done).length, [events]);

  const selectedEvents = useMemo(() => {
    return events
      .filter(e => e.date === selectedDate)
      .filter(e => (filterType === "all" ? true : e.type === filterType))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [events, selectedDate, filterType]);

  const countsByType = useMemo(() => {
    const list = events.filter(e => e.date === selectedDate);
    return {
      all: list.length,
      task: list.filter(e => e.type === "task").length,
      meeting: list.filter(e => e.type === "meeting").length,
      reminder: list.filter(e => e.type === "reminder").length,
      personal: list.filter(e => e.type === "personal").length,
    };
  }, [events, selectedDate]);

  const handleAddEvent = () => {
    if (!form.title.trim()) {
      onShowToast(language === "EN" ? "Please enter event title" : "Mohon isi judul acara", "alert");
      return;
    }
    onAdd(form);
    onShowToast(
      language === "EN"
        ? `Event "${form.title}" successfully added!`
        : `Jadwal "${form.title}" berhasil ditambahkan!`,
      "success"
    );
    setForm({ title: "", date: selectedDate, time: "09:00", type: "task", recurring: "none", note: "", done: false });
    setShowForm(false);
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
    const localNowStr = getLocalDateStr(now);
    setSelectedDate(localNowStr);
    setForm(f => ({ ...f, date: localNowStr }));
  };

  const getRecurringLabel = (rule: RecurringRule) => {
    switch (rule) {
      case "daily": return language === "EN" ? "Daily" : "Harian";
      case "weekly": return language === "EN" ? "Weekly" : "Mingguan";
      case "monthly": return language === "EN" ? "Monthly" : "Bulanan";
      case "yearly": return language === "EN" ? "Yearly" : "Tahunan";
      default: return "";
    }
  };

  return (
    <div className="tab-scroll h-full px-4 py-4 space-y-4 animate-fade-in select-none">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-lg shadow-teal-500/10">
            <i className="fa-solid fa-calendar-days text-lg" />
          </div>
          <div>
            <h2 className="text-white font-extrabold text-base tracking-tight flex items-center gap-2">
              <span>{language === "EN" ? "Schedule & Reminders" : "Jadwal & Pengingat"}</span>
            </h2>
            <p className="text-white/40 text-xs font-medium">
              {language === "EN" ? "Manage Agenda, Reminders & Recurring Bills" : "Kelola Agenda, Pengingat & Tagihan Rutin"}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowForm(!showForm);
            setForm(f => ({ ...f, date: selectedDate }));
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-extrabold shadow-lg transition-all active:scale-95 border border-teal-400/30"
          style={{ background: showForm ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)" }}
        >
          <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"} text-xs`} />
          <span>{showForm ? (language === "EN" ? "Cancel" : "Batal") : (language === "EN" ? "New Event" : "Buat Jadwal")}</span>
        </button>
      </div>

      {/* Overview Analytics Bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-2xl p-3 border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-transparent">
          <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold mb-1">
            <i className="fa-solid fa-list text-[11px]" />
            <span>{language === "EN" ? "Total Agenda" : "Total Agenda"}</span>
          </div>
          <p className="text-white font-extrabold text-lg font-mono">{totalEventsCount}</p>
        </div>

        <div className="glass-card rounded-2xl p-3 border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
            <i className="fa-solid fa-clock text-[11px]" />
            <span>{language === "EN" ? "Pending" : "Belum Selesai"}</span>
          </div>
          <p className="text-amber-300 font-extrabold text-lg font-mono">{pendingEventsCount}</p>
        </div>

        <div className="glass-card rounded-2xl p-3 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
            <i className="fa-solid fa-circle-check text-[11px]" />
            <span>{language === "EN" ? "Completed" : "Selesai"}</span>
          </div>
          <p className="text-emerald-300 font-extrabold text-lg font-mono">{completedEventsCount}</p>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Month Header & Controls */}
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-white font-extrabold text-sm tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-calendar-day text-teal-400 text-xs" />
              {monthNames[viewDate.month]} {viewDate.year}
            </span>
            {/* Quick jump to Today button */}
            <button
              onClick={handleJumpToToday}
              className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 transition-all flex items-center gap-1 active:scale-95"
              title={language === "EN" ? "Jump to Today" : "Kembali ke Hari Ini"}
            >
              <i className="fa-solid fa-crosshairs text-[9px]" />
              <span>{language === "EN" ? "Today" : "Hari Ini"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })}
              className="w-7 h-7 glass rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors border border-white/10 active:scale-95"
            >
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
            <button
              onClick={() => setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })}
              className="w-7 h-7 glass rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors border border-white/10 active:scale-95"
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {dayNames.map((d, idx) => (
            <span
              key={d}
              className={`text-[10px] font-extrabold uppercase tracking-wider ${
                idx === 0 ? "text-rose-400/80" : idx === 6 ? "text-amber-400/80" : "text-white/40"
              }`}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {blanks.map(b => <div key={`b-${b}`} />)}
          {daysArr.map(d => {
            const ds = formatDS(d);
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDate;
            const evs = eventsOnDate(d);

            return (
              <button
                key={d}
                onClick={() => {
                  setSelectedDate(ds);
                  setForm(f => ({ ...f, date: ds }));
                }}
                className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all min-h-[38px] active:scale-95 ${
                  isSelected
                    ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30 border border-teal-300/40"
                    : isToday
                    ? "bg-violet-500/20 border border-violet-500/50 text-violet-300 font-bold"
                    : "hover:bg-white/5 border border-transparent text-white/80"
                }`}
              >
                <span className={`text-xs font-mono font-bold ${isSelected ? "text-white" : isToday ? "text-violet-300" : "text-white/80"}`}>
                  {d}
                </span>

                {evs.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {evs.slice(0, 3).map((ev, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full shadow-sm"
                        style={{ background: EVENT_COLORS[ev.type] || "#14b8a6" }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Schedule Form Modal */}
      {showForm && (
        <div className="glass-strong rounded-2xl p-4 space-y-3.5 border border-teal-500/40 animate-slide-up shadow-2xl relative z-30">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <p className="text-white text-xs font-extrabold uppercase tracking-wider text-teal-300 flex items-center gap-2">
              <i className="fa-solid fa-calendar-plus text-sm text-teal-400" />
              <span>{language === "EN" ? "Set New Agenda / Reminder" : "Tambah Acara / Tagihan Rutin"}</span>
            </p>
            <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xs p-1">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Agenda Title Input */}
          <div className="glass rounded-xl px-3 py-2">
            <label className="text-white/40 text-[10px] block mb-1 uppercase font-semibold tracking-wider flex items-center gap-1">
              <i className="fa-solid fa-heading text-teal-400 text-[10px]" />
              {language === "EN" ? "Agenda Title" : "Judul Agenda"}
            </label>
            <input
              type="text"
              placeholder={language === "EN" ? "e.g. Pay Internet Bill / Sync Meeting..." : "Contoh: Bayar Tagihan Wifi / Meeting Sync..."}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-transparent text-white text-xs font-medium focus:outline-none placeholder:text-white/30"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2 relative z-20">
            {/* Time Selector */}
            <div className="glass rounded-xl px-3 py-2 relative z-30">
              <label className="text-white/40 text-[10px] block mb-1 uppercase font-semibold tracking-wider flex items-center gap-1">
                <i className="fa-solid fa-clock text-teal-400 text-[10px]" />
                {language === "EN" ? "Time" : "Waktu"}
              </label>
              <CustomTimePicker
                value={form.time}
                onChange={timeStr => setForm(f => ({ ...f, time: timeStr }))}
                className="w-full"
              />
            </div>

            {/* Event Type Dropdown */}
            <div className="glass rounded-xl px-3 py-2 relative z-30">
              <label className="text-white/40 text-[10px] block mb-1 uppercase font-semibold tracking-wider flex items-center gap-1">
                <i className="fa-solid fa-tag text-teal-400 text-[10px]" />
                {language === "EN" ? "Event Type" : "Tipe Agenda"}
              </label>
              <CustomDropdown<ScheduleEvent["type"]>
                value={form.type}
                options={[
                  { value: "task", label: language === "EN" ? "Task" : "Tugas", icon: <i className="fa-solid fa-list-check text-teal-400 mr-1 text-xs" /> },
                  { value: "meeting", label: language === "EN" ? "Meeting" : "Meeting", icon: <i className="fa-solid fa-users text-indigo-400 mr-1 text-xs" /> },
                  { value: "reminder", label: language === "EN" ? "Reminder" : "Pengingat", icon: <i className="fa-solid fa-bell text-amber-400 mr-1 text-xs" /> },
                  { value: "personal", label: language === "EN" ? "Personal" : "Personal", icon: <i className="fa-solid fa-user-gear text-pink-400 mr-1 text-xs" /> },
                ]}
                onChange={val => setForm(f => ({ ...f, type: val }))}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 relative z-10">
            {/* Recurring Dropdown */}
            <div className="glass rounded-xl px-3 py-2 relative z-20">
              <label className="text-white/40 text-[10px] block mb-1 uppercase font-semibold tracking-wider flex items-center gap-1">
                <i className="fa-solid fa-rotate text-teal-400 text-[10px]" />
                {language === "EN" ? "Repeat Rule" : "Pengulangan"}
              </label>
              <CustomDropdown<RecurringRule>
                value={form.recurring}
                options={[
                  { value: "none", label: language === "EN" ? "Once Only" : "Sekali Saja", icon: <i className="fa-solid fa-ban text-white/40 mr-1 text-xs" /> },
                  { value: "daily", label: language === "EN" ? "Daily" : "Setiap Hari", icon: <i className="fa-solid fa-calendar-day text-teal-400 mr-1 text-xs" /> },
                  { value: "weekly", label: language === "EN" ? "Weekly" : "Setiap Minggu", icon: <i className="fa-solid fa-calendar-week text-indigo-400 mr-1 text-xs" /> },
                  { value: "monthly", label: language === "EN" ? "Monthly" : "Setiap Bulan", icon: <i className="fa-solid fa-calendar-days text-amber-400 mr-1 text-xs" /> },
                  { value: "yearly", label: language === "EN" ? "Yearly" : "Setiap Tahun", icon: <i className="fa-solid fa-calendar text-pink-400 mr-1 text-xs" /> },
                ]}
                onChange={val => setForm(f => ({ ...f, recurring: val }))}
                className="w-full"
              />
            </div>

            {/* Date Picker */}
            <div className="glass rounded-xl px-3 py-2">
              <label className="text-white/40 text-[10px] block mb-1 uppercase font-semibold tracking-wider flex items-center gap-1">
                <i className="fa-solid fa-calendar-day text-teal-400 text-[10px]" />
                {language === "EN" ? "Date" : "Tanggal"}
              </label>
              <CustomDatePicker
                value={form.date}
                onChange={dateStr => setForm(f => ({ ...f, date: dateStr }))}
                className="w-full"
              />
            </div>
          </div>

          {/* Note Input */}
          <div className="glass rounded-xl px-3 py-2">
            <label className="text-white/40 text-[10px] block mb-1 uppercase font-semibold tracking-wider flex items-center gap-1">
              <i className="fa-solid fa-note-sticky text-teal-400 text-[10px]" />
              {language === "EN" ? "Additional Notes" : "Catatan Tambahan"}
            </label>
            <input
              type="text"
              placeholder={language === "EN" ? "Location details or instructions..." : "Detail lokasi atau instruksi..."}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full bg-transparent text-white text-xs font-medium focus:outline-none placeholder:text-white/30"
            />
          </div>

          <button
            onClick={handleAddEvent}
            className="w-full py-3 rounded-xl text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-teal-500/20 active:scale-[0.98] border border-teal-400/30 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)" }}
          >
            <i className="fa-solid fa-check text-sm" />
            <span>{language === "EN" ? "Save Agenda Event" : "Simpan Agenda"}</span>
          </button>
        </div>
      )}

      {/* Selected Date Header & Filter Badges */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-extrabold text-xs flex items-center gap-1.5">
            <i className="fa-solid fa-clock text-teal-400 text-xs" />
            <span>
              {language === "EN" ? "Agenda: " : "Agenda: "}
              {new Date(selectedDate + "T00:00:00").toLocaleDateString(language === "EN" ? "en-US" : "id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </span>
          <span className="text-teal-300 text-[10px] font-mono px-2 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
            {selectedEvents.length} {language === "EN" ? "events" : "acara"}
          </span>
        </div>

        {/* Filter Pills Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-3 no-scrollbar">
          {[
            { id: "all", label: language === "EN" ? "All" : "Semua", icon: "fa-solid fa-layer-group", count: countsByType.all },
            { id: "task", label: language === "EN" ? "Task" : "Tugas", icon: "fa-solid fa-list-check", count: countsByType.task },
            { id: "meeting", label: language === "EN" ? "Meeting" : "Meeting", icon: "fa-solid fa-users", count: countsByType.meeting },
            { id: "reminder", label: language === "EN" ? "Reminder" : "Pengingat", icon: "fa-solid fa-bell", count: countsByType.reminder },
            { id: "personal", label: language === "EN" ? "Personal" : "Personal", icon: "fa-solid fa-user-gear", count: countsByType.personal },
          ].map(t => {
            const isActive = filterType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 active:scale-95 ${
                  isActive
                    ? "bg-teal-500/25 text-teal-300 border border-teal-500/40 shadow-lg shadow-teal-500/10"
                    : "bg-white/5 text-white/50 border border-white/10 hover:text-white hover:bg-white/10"
                }`}
              >
                <i className={`${t.icon} text-[10px]`} />
                <span>{t.label}</span>
                <span className={`text-[10px] font-mono px-1 rounded-full ${isActive ? "bg-teal-400/20 text-teal-200" : "bg-white/10 text-white/40"}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Schedule List */}
        {selectedEvents.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-center border border-white/10 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-2 shadow-lg shadow-teal-500/10">
              <i className="fa-solid fa-calendar-xmark text-2xl" />
            </div>
            <p className="text-white/80 text-xs font-bold">
              {language === "EN" ? "No events scheduled for this date" : "Tidak ada agenda pada tanggal ini"}
            </p>
            <p className="text-white/40 text-[11px] mt-1 max-w-xs">
              {language === "EN"
                ? "Click '+ New Event' to set reminders or recurring bills."
                : "Klik '+ Buat Jadwal' untuk menambahkan pengingat atau tagihan baru."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedEvents.map(ev => {
              const recurringLabel = getRecurringLabel(ev.recurring);
              const eventColor = EVENT_COLORS[ev.type] || "#14b8a6";

              return (
                <div
                  key={ev.id}
                  className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:border-white/20"
                  style={{ opacity: ev.done ? 0.6 : 1 }}
                >
                  {/* Complete Checkbox Toggle */}
                  <button
                    onClick={() => onToggle(ev.id)}
                    className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center transition-all active:scale-95 border"
                    style={{
                      background: ev.done ? eventColor : "rgba(255,255,255,0.05)",
                      borderColor: eventColor,
                      boxShadow: ev.done ? `0 0 10px ${eventColor}55` : "none",
                    }}
                  >
                    {ev.done ? (
                      <i className="fa-solid fa-check text-white text-xs" />
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ background: eventColor }} />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-white text-xs font-extrabold truncate"
                        style={{ textDecoration: ev.done ? "line-through" : "none" }}
                      >
                        {ev.title}
                      </p>
                      {recurringLabel && (
                        <span className="chip bg-white/10 text-white/60 text-[9px] px-1.5 py-0.5 flex items-center gap-1">
                          <i className="fa-solid fa-repeat text-[8px] text-teal-400" />
                          {recurringLabel}
                        </span>
                      )}
                    </div>

                    {ev.note && (
                      <p className="text-white/40 text-[11px] truncate mt-0.5 flex items-center gap-1">
                        <i className="fa-solid fa-note-sticky text-[9px] text-white/30" />
                        {ev.note}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <div>
                      <p className="text-teal-300 text-xs font-mono font-bold flex items-center justify-end gap-1">
                        <i className="fa-solid fa-clock text-[10px] text-teal-400/80" />
                        {ev.time}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span
                          className="chip text-[9px] font-extrabold capitalize px-1.5 py-0.5"
                          style={{ background: `${eventColor}22`, color: eventColor, border: `1px solid ${eventColor}44` }}
                        >
                          {ev.type}
                        </span>
                      </div>
                    </div>

                    {/* Delete Agenda Button */}
                    <button
                      onClick={() => setDeleteConfirmId(ev.id)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white/30 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 transition-all active:scale-95 ml-1"
                      title={language === "EN" ? "Delete Event" : "Hapus Agenda"}
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={language === "EN" ? "Delete Agenda Event" : "Hapus Agenda"}
        message={
          targetEvent
            ? language === "EN"
              ? `Are you sure you want to delete event "${targetEvent.title}" scheduled for ${targetEvent.time}? This action cannot be undone.`
              : `Apakah Anda yakin ingin menghapus agenda "${targetEvent.title}" pada jam ${targetEvent.time}? Agenda yang dihapus tidak dapat dikembalikan.`
            : language === "EN"
            ? "Are you sure you want to delete this event?"
            : "Apakah Anda yakin ingin menghapus agenda ini?"
        }
        confirmText={language === "EN" ? "Yes, Delete" : "Ya, Hapus"}
        cancelText={language === "EN" ? "Cancel" : "Batal"}
        onConfirm={() => {
          if (deleteConfirmId) {
            onDelete(deleteConfirmId);
            onShowToast(language === "EN" ? "Event deleted" : "Agenda berhasil dihapus", "info");
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <div className="h-6" />
    </div>
  );
}

// ─── Backend Planner & API Specification Explorer Component ───────────────────
function BackendPlannerTab() {
  const [activeSection, setActiveSection] = useState<"erd" | "api" | "auth" | "queue">("erd");
  const [apiTestResult, setApiTestResult] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const testApi = async (endpoint: string) => {
    setApiLoading(true);
    try {
      const baseUrl = getApiBaseUrl().replace(/\/api\/v1$/, "");
      const res = await fetch(`${baseUrl}${endpoint}`);
      const data = await res.json();
      setApiTestResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setApiTestResult(JSON.stringify({
        status: "simulated_backend",
        message: "API Server dapat dijalankan dengan command: npm run server (port 5000)",
        endpoint: endpoint,
        sampleResponse: {
          success: true,
          service: "Mobile Finance Tracker REST API",
          data: "Live server response format demo"
        }
      }, null, 2));
    } finally {
      setApiLoading(false);
    }
  };

  const prismaSchemaCode = `model User {
  id           String        @id @default(uuid())
  email        String        @unique
  fullName     String
  currency     String        @default("IDR")
  transactions Transaction[]
  budgets      Budget[]
  schedules    Schedule[]
}

model Transaction {
  id              String          @id @default(uuid())
  userId          String
  type            TransactionType // INCOME | EXPENSE
  amount          Decimal         @db.Decimal(15, 2)
  category        String
  transactionDate DateTime
}`;

  const apiEndpoints = [
    { method: "POST", path: "/api/v1/auth/login", desc: "Autentikasi user & rilis JWT Access Token" },
    { method: "GET", path: "/api/v1/transactions", desc: "List transaksi dengan filter tanggal & pencarian" },
    { method: "POST", path: "/api/v1/transactions", desc: "Catat transaksi pemasukan / pengeluaran baru" },
    { method: "GET", path: "/api/v1/budgets", desc: "Evaluasi pengeluaran vs batas anggaran bulanan" },
    { method: "POST", path: "/api/v1/schedules", desc: "Buat pengingat / tagihan rutin dengan cron worker" },
  ];


  return (
    <div className="tab-scroll h-full px-4 py-4 space-y-4 animate-fade-in">
      <div>
        <h2 className="text-white font-bold text-lg">Backend Architecture Plan</h2>
        <p className="text-white/40 text-xs">Desain Database, REST API & Worker Architecture</p>
      </div>

      {/* Sub Section Nav */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        {[
          { id: "erd", label: "🗄️ ERD Schema" },
          { id: "api", label: "🔌 API Spec" },
          { id: "auth", label: "🔒 Security" },
          { id: "queue", label: "⚡ Push Queue" },
        ].map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id as any)}
            className="flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all"
            style={{
              background: activeSection === sec.id ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "transparent",
              color: activeSection === sec.id ? "#fff" : "rgba(255,255,255,0.4)",
            }}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* ERD View */}
      {activeSection === "erd" && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-violet-300 font-bold text-xs uppercase tracking-wider">Prisma ORM Schema Definition</p>
            <span className="chip bg-violet-500/20 text-violet-300">PostgreSQL 16</span>
          </div>

          <pre className="bg-slate-950/80 p-3 rounded-xl text-emerald-400 text-[11px] font-mono overflow-x-auto border border-white/10 leading-relaxed">
            {prismaSchemaCode}
          </pre>

          <div className="text-white/60 text-xs space-y-1.5">
            <p><strong>Relasi Entitas:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-white/50 text-[11px]">
              <li>User Memiliki Banyak (1:N) Transaksi & Agenda Schedule.</li>
              <li>Indeks Komposisi pada `[userId, transactionDate]` untuk query cepat.</li>
              <li>Precision Decimal `(15,2)` untuk komputasi mata uang yang akurat.</li>
            </ul>
          </div>
        </div>
      )}

      {/* API Spec View */}
      {activeSection === "api" && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-indigo-300 font-bold text-xs uppercase tracking-wider">Spesifikasi REST API v1</p>
            <button
              onClick={() => testApi("/api/v1/health")}
              className="px-2.5 py-1 glass rounded-lg text-emerald-400 text-[10px] font-bold hover:bg-white/10 transition-all flex items-center gap-1"
            >
              <span>{apiLoading ? "⏳ Pinging..." : "⚡ Test Health API"}</span>
            </button>
          </div>

          <div className="space-y-2">
            {apiEndpoints.map((ep, i) => (
              <div key={i} className="glass p-2.5 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase flex-shrink-0"
                    style={{
                      background: ep.method === "GET" ? "rgba(52,211,153,0.2)" : "rgba(99,102,241,0.2)",
                      color: ep.method === "GET" ? "#34d399" : "#818cf8",
                    }}
                  >
                    {ep.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-mono font-semibold truncate">{ep.path}</p>
                    <p className="text-white/40 text-[11px] truncate">{ep.desc}</p>
                  </div>
                </div>

                {ep.method === "GET" && (
                  <button
                    onClick={() => testApi(ep.path)}
                    className="px-2 py-1 glass rounded text-[10px] text-violet-300 font-semibold flex-shrink-0 hover:bg-white/10"
                  >
                    Test
                  </button>
                )}
              </div>
            ))}
          </div>

          {apiTestResult && (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-[10px] uppercase font-semibold">Respon JSON Backend Server:</span>
                <button onClick={() => setApiTestResult(null)} className="text-white/30 text-[10px]">Tutup</button>
              </div>
              <pre className="bg-slate-950/90 p-3 rounded-xl text-cyan-300 text-[10px] font-mono overflow-x-auto border border-white/10 max-h-48">
                {apiTestResult}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Auth & Security View */}
      {activeSection === "auth" && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in">
          <p className="text-amber-300 font-bold text-xs uppercase tracking-wider">Arsitektur Keamanan & Auth</p>

          <div className="space-y-2 text-xs">
            <div className="glass p-3 rounded-xl space-y-1">
              <p className="text-white font-semibold">🔑 Dual-Token Authentication</p>
              <p className="text-white/50 text-[11px]">
                Access Token singkat (15 menit) disimpan di memory client. Refresh Token (7 hari) disimpan di secure httpOnly cookie.
              </p>
            </div>

            <div className="glass p-3 rounded-xl space-y-1">
              <p className="text-white font-semibold">🛡️ Rate Limiting & Protection</p>
              <p className="text-white/50 text-[11px]">
                Pencegahan Brute-force dengan limit 5 request login/menit per IP. Proteksi Header dengan Helmet.js & CORS origin whitelist.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Queue View */}
      {activeSection === "queue" && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in">
          <p className="text-teal-300 font-bold text-xs uppercase tracking-wider">Notifikasi & Worker Background</p>

          <div className="glass p-3 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span className="text-white text-xs font-semibold">Redis + BullMQ Scheduler</span>
            </div>
            <p className="text-white/50 text-[11px]">
              Cron runner mengeksekusi pemeriksaan agenda pengingat tagihan secara berkala, mengirimkan push payload ke Service Worker PWA & FCM.
            </p>
          </div>
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}

// ─── Auth Validation Helpers ───────────────────────────────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#475569" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Lemah", color: "#ef4444" };
  if (score <= 2) return { score, label: "Cukup", color: "#f97316" };
  if (score <= 3) return { score, label: "Sedang", color: "#eab308" };
  if (score === 4) return { score, label: "Kuat", color: "#22c55e" };
  return { score, label: "Sangat Kuat", color: "#10b981" };
}

function validateAuthFields(
  mode: "login" | "register",
  fields: { fullName: string; email: string; password: string; confirmPassword: string }
): Record<string, string> {
  const errors: Record<string, string> = {};
  const { fullName, email, password, confirmPassword } = fields;

  if (mode === "register") {
    const name = fullName.trim();
    if (!name) errors.fullName = "Nama lengkap wajib diisi.";
    else if (name.length < 2) errors.fullName = "Nama minimal 2 karakter.";
    else if (name.length > 80) errors.fullName = "Nama terlalu panjang (maks 80 karakter).";
    else if (/[0-9]/.test(name)) errors.fullName = "Nama tidak boleh mengandung angka.";
    else if (/[^a-zA-Z\s\u00C0-\u024F\u1E00-\u1EFF''\-]/.test(name))
      errors.fullName = "Nama hanya boleh berisi huruf dan spasi.";
  }

  const trimEmail = email.trim();
  if (!trimEmail) errors.email = "Email wajib diisi.";
  else if (!EMAIL_RE.test(trimEmail)) errors.email = "Format email tidak valid. Contoh: nama@email.com";

  if (!password) {
    errors.password = "Password wajib diisi.";
  } else if (mode === "register") {
    if (password.length < 8) errors.password = "Password minimal 8 karakter.";
    else if (!/[A-Z]/.test(password)) errors.password = "Harus ada minimal satu huruf kapital (A-Z).";
    else if (!/[0-9]/.test(password)) errors.password = "Harus ada minimal satu angka (0-9).";
    else if (/\s/.test(password)) errors.password = "Password tidak boleh mengandung spasi.";
  }

  if (mode === "register" && !errors.password) {
    if (!confirmPassword) errors.confirmPassword = "Konfirmasi password wajib diisi.";
    else if (confirmPassword !== password) errors.confirmPassword = "Password tidak cocok.";
  }

  return errors;
}

// ─── Auth Field Wrapper Component ─────────────────────────────────────────────
function FieldWrap({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-white/60 text-[11px] font-semibold block">{label}</label>
      <div
        className="glass px-3.5 py-2.5 rounded-xl transition-all"
        style={{
          borderColor: error ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)",
          borderWidth: 1, borderStyle: "solid",
          boxShadow: error ? "0 0 12px rgba(239,68,68,0.15)" : undefined,
        }}
      >
        {children}
      </div>
      {error && (
        <p className="text-rose-400 text-[10px] font-medium flex items-center gap-1 pl-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

// ─── Auth Modal Component ──────────────────────────────────────────────────────
function AuthModal({
  onSuccess,
  onShowToast,
}: {
  onSuccess: (user: User) => void;
  onShowToast: (msg: string, type: "success" | "info" | "alert") => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const pwStrength = getPasswordStrength(password);

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setGlobalError(null);
    setFieldErrors({});
    setSubmitted(false);
    setPassword("");
    setConfirmPassword("");
    setShowPw(false);
    setShowConfirmPw(false);
  };

  const liveErrors = submitted
    ? validateAuthFields(mode, { fullName, email, password, confirmPassword })
    : {};

  const hasErrors = Object.keys(liveErrors).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setGlobalError(null);
    const errors = validateAuthFields(mode, { fullName, email, password, confirmPassword });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const payload = mode === "login"
        ? { email: email.trim(), password }
        : { email: email.trim(), password, fullName: fullName.trim() };

      const apiBase = getApiBaseUrl();
      let res: Response | null = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        res = await fetch(`${apiBase}${endpoint.replace("/api/v1", "")}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch {
        res = null; // Backend not available or offline
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          onSuccess(data.user);
          onShowToast(
            mode === "login"
              ? `Selamat datang kembali, ${data.user.fullName}! 👋`
              : `Akun berhasil dibuat! Selamat datang, ${data.user.fullName} ✨`,
            "success"
          );
          return;
        } else {
          if (data.fieldErrors) setFieldErrors(data.fieldErrors);
          setGlobalError(data.error || "Gagal memproses autentikasi.");
          return;
        }
      }

      // ── Client-Side Fallback Auth (Deployment / Offline Mode) ──
      const localUsersKey = "mft_registered_users";
      const existingUsersStr = localStorage.getItem(localUsersKey);
      const localUsers: Array<{ id: string; email: string; fullName: string; password?: string; currency?: string }> =
        existingUsersStr ? JSON.parse(existingUsersStr) : [];

      if (mode === "register") {
        const duplicate = localUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
        if (duplicate) {
          setFieldErrors({ email: "Email sudah terdaftar." });
          setGlobalError("Email sudah terdaftar. Silakan gunakan email lain atau login.");
          return;
        }

        const newUser = {
          id: "u_" + Date.now(),
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          password: password,
          currency: "IDR",
        };
        localUsers.push(newUser);
        localStorage.setItem(localUsersKey, JSON.stringify(localUsers));

        onSuccess({ id: newUser.id, email: newUser.email, fullName: newUser.fullName, currency: newUser.currency });
        onShowToast(`Akun berhasil dibuat! Selamat datang, ${newUser.fullName} ✨ (Mode Offline)`, "success");
      } else {
        // Login mode
        const userMatch = localUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
        if (userMatch) {
          if (userMatch.password && userMatch.password !== password) {
            setGlobalError("Password yang Anda masukkan salah. Coba lagi.");
            return;
          }
          onSuccess({ id: userMatch.id, email: userMatch.email, fullName: userMatch.fullName, currency: userMatch.currency || "IDR" });
          onShowToast(`Selamat datang kembali, ${userMatch.fullName}! 👋 (Mode Offline)`, "success");
        } else {
          // Automatic seamless creation for new login attempt in offline/deployment mode
          const newLocalUser = {
            id: "u_" + Date.now(),
            email: email.trim().toLowerCase(),
            fullName: email.trim().split("@")[0] || "User",
            password: password,
            currency: "IDR",
          };
          localUsers.push(newLocalUser);
          localStorage.setItem(localUsersKey, JSON.stringify(localUsers));
          onSuccess({ id: newLocalUser.id, email: newLocalUser.email, fullName: newLocalUser.fullName, currency: "IDR" });
          onShowToast(`Login berhasil! Selamat datang, ${newLocalUser.fullName} ✨ (Mode Offline)`, "success");
        }
      }
    } catch (err: any) {
      setGlobalError("Terjadi kesalahan autentikasi: " + (err.message || "Gagal memproses"));
    } finally {
      setLoading(false);
    }
  };

  const inputBase = "w-full bg-transparent text-white text-xs placeholder:text-white/30 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-sm glass-card rounded-3xl p-6 border border-white/20 shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 mx-auto flex items-center justify-center text-2xl shadow-lg">
            🔐
          </div>
          <h2 className="text-white font-extrabold text-xl tracking-tight">
            {mode === "login" ? "Masuk ke Akun" : "Daftar Akun Baru"}
          </h2>
          <p className="text-white/40 text-xs">
            {mode === "login"
              ? "Kelola keuangan pribadi Anda dengan aman"
              : "Buat akun pribadi untuk mulai mencatat keuangan"}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button onClick={() => switchMode("login")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === "login" ? "bg-violet-600 text-white shadow-md" : "text-white/40 hover:text-white/70"
            }`}>
            🔑 Login
          </button>
          <button onClick={() => switchMode("register")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === "register" ? "bg-violet-600 text-white shadow-md" : "text-white/40 hover:text-white/70"
            }`}>
            ✨ Daftar
          </button>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2">
            <span className="flex-shrink-0">⚠️</span>
            <span>{globalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {/* Full Name */}
          {mode === "register" && (
            <FieldWrap label="Nama Lengkap" error={liveErrors.fullName}>
              <input type="text" placeholder="Contoh: Budi Santoso" value={fullName}
                onChange={e => setFullName(e.target.value)}
                className={inputBase} autoComplete="name" />
            </FieldWrap>
          )}

          {/* Email */}
          <FieldWrap label="Alamat Email" error={liveErrors.email}>
            <input type="email" placeholder="nama@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputBase} autoComplete="email" />
          </FieldWrap>

          {/* Password */}
          <FieldWrap label="Kata Sandi (Password)" error={liveErrors.password}>
            <div className="flex items-center gap-2">
              <input type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                className={`${inputBase} flex-1`}
                autoComplete={mode === "login" ? "current-password" : "new-password"} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="text-white/40 hover:text-white/80 text-xs transition-colors flex-shrink-0"
                tabIndex={-1}>
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </FieldWrap>

          {/* Password Strength Meter */}
          {mode === "register" && password.length > 0 && (
            <div className="space-y-1 -mt-1">
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-all"
                    style={{ background: i <= pwStrength.score ? pwStrength.color : "rgba(255,255,255,0.08)" }} />
                ))}
              </div>
              <p className="text-[10px] font-semibold" style={{ color: pwStrength.color }}>
                Kekuatan: {pwStrength.label}
                {pwStrength.score < 3 && (
                  <span className="text-white/30 font-normal ml-1">— tambah huruf kapital, angka, atau simbol</span>
                )}
              </p>
            </div>
          )}

          {/* Confirm Password */}
          {mode === "register" && (
            <FieldWrap label="Konfirmasi Password" error={liveErrors.confirmPassword}>
              <div className="flex items-center gap-2">
                <input type={showConfirmPw ? "text" : "password"} placeholder="••••••••" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={`${inputBase} flex-1`} autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                  className="text-white/40 hover:text-white/80 text-xs transition-colors flex-shrink-0"
                  tabIndex={-1}>
                  {showConfirmPw ? "🙈" : "👁"}
                </button>
              </div>
            </FieldWrap>
          )}

          {/* Password Requirements Checklist */}
          {mode === "register" && (
            <div className="glass rounded-xl p-3 space-y-1">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">Syarat Password</p>
              {[
                { rule: password.length >= 8,       label: "Minimal 8 karakter" },
                { rule: /[A-Z]/.test(password),     label: "Minimal 1 huruf kapital (A-Z)" },
                { rule: /[0-9]/.test(password),     label: "Minimal 1 angka (0-9)" },
                { rule: !/\s/.test(password) && password.length > 0, label: "Tanpa spasi" },
              ].map(({ rule, label }) => (
                <p key={label} className="text-[10px] flex items-center gap-1.5">
                  <span style={{ color: rule ? "#34d399" : "#475569" }}>{rule ? "✓" : "○"}</span>
                  <span style={{ color: rule ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>{label}</span>
                </p>
              ))}
            </div>
          )}

          {/* Submit */}
          <button type="submit"
            disabled={loading || (submitted && hasErrors)}
            className="w-full py-3 rounded-xl text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
            {loading ? "⏳ Memproses..."
              : mode === "login" ? "🔑 Masuk Sekarang"
              : "✨ Buat Akun"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Custom Switch Toggle Helper ───────────────────────────────────────────────
function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-label="Toggle Switch"
      className={`relative w-12 h-6.5 rounded-full transition-all duration-300 flex-shrink-0 p-0.5 border shadow-inner ${
        value
          ? "bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500/50 shadow-violet-500/30"
          : "bg-slate-300 dark:bg-slate-700/80 border-slate-400/70 dark:border-slate-600"
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full transition-all duration-300 shadow-md ${
          value
            ? "translate-x-5.5 bg-white preserve-white border border-white"
            : "translate-x-0 bg-white dark:bg-slate-200 border border-slate-300 dark:border-slate-500"
        }`}
      />
    </button>
  );
}

// ─── PIN Lock Overlay Component (Full Screen Lock) ───────────────────────────
function PinLockScreenModal({
  onUnlock,
  language = "ID",
}: {
  onUnlock: (pin: string) => boolean;
  language?: Lang;
}) {
  const [pinInput, setPinInput] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const pinRef = useRef<string>("");
  pinRef.current = pinInput;

  const handleKeyPress = useCallback((num: string) => {
    setIsError(false);
    if (pinRef.current.length < 4) {
      const nextPin = pinRef.current + num;
      setPinInput(nextPin);

      if (nextPin.length === 4) {
        setTimeout(() => {
          const success = onUnlock(nextPin);
          if (!success) {
            setIsError(true);
            setErrorMessage(language === "EN" ? "Incorrect PIN! Please try again." : "PIN Salah! Silakan coba lagi.");
            setPinInput("");
          }
        }, 150);
      }
    }
  }, [language, onUnlock]);

  const handleBackspace = useCallback(() => {
    setIsError(false);
    setPinInput((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setIsError(false);
    setPinInput("");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyPress, handleBackspace, handleClear]);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 bg-[#050714]/95 backdrop-blur-2xl animate-fade-in select-none">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-sky-600/15 rounded-full blur-[100px] pointer-events-none" />

      <div className={`relative z-10 w-full max-w-sm flex flex-col items-center text-center space-y-6 ${isError ? "animate-shake" : ""}`}>
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 via-indigo-600 to-sky-500 p-0.5 shadow-2xl shadow-violet-500/30">
            <div className="w-full h-full rounded-[22px] bg-[#0c0e21] flex items-center justify-center text-3xl text-violet-400">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-white text-xl font-extrabold tracking-tight">
            {language === "EN" ? "Security PIN Lock" : "Masukkan PIN Keamanan"}
          </h2>
          <p className="text-slate-400 text-xs max-w-xs">
            {language === "EN"
              ? "App is locked to protect your financial privacy."
              : "Aplikasi terkunci untuk menjaga privasi keuangan Anda."}
          </p>
        </div>

        {/* 4 Digit Dots */}
        <div className="flex items-center justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pinInput.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? "bg-gradient-to-r from-violet-500 to-indigo-500 border-2 border-violet-300 scale-110 shadow-lg shadow-violet-500/60"
                    : isError
                    ? "border-2 border-rose-500 bg-rose-500/20"
                    : "border-2 border-white/30 bg-white/5"
                }`}
              />
            );
          })}
        </div>

        {isError && (
          <p className="text-rose-400 text-xs font-semibold animate-fade-in">{errorMessage}</p>
        )}

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px] pt-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="w-16 h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-90 active:bg-violet-600/40 border border-white/10 text-white font-bold text-2xl flex items-center justify-center shadow-lg transition-all duration-150 mx-auto"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="w-16 h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-90 border border-white/10 text-white/50 hover:text-white font-semibold text-xs flex items-center justify-center transition-all duration-150 mx-auto uppercase tracking-wider"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="w-16 h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-90 active:bg-violet-600/40 border border-white/10 text-white font-bold text-2xl flex items-center justify-center shadow-lg transition-all duration-150 mx-auto"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="w-16 h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-90 border border-white/10 text-white/60 hover:text-white font-bold text-lg flex items-center justify-center transition-all duration-150 mx-auto"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Setup 4-Digit PIN Modal ──────────────────────────────────────────────────
function SetupPinModal({
  isOpen,
  onClose,
  onSavePin,
  language = "ID",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSavePin: (pin: string) => void;
  language?: Lang;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isShake, setIsShake] = useState<boolean>(false);

  const stepRef = useRef<1 | 2>(1);
  stepRef.current = step;
  const firstPinRef = useRef<string>("");
  firstPinRef.current = firstPin;
  const confirmPinRef = useRef<string>("");
  confirmPinRef.current = confirmPin;

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFirstPin("");
      setConfirmPin("");
      setErrorMsg("");
      setIsShake(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentInput = step === 1 ? firstPin : confirmPin;

  const handleKeyPress = (num: string) => {
    if (isShake) setIsShake(false);

    if (stepRef.current === 1) {
      if (firstPinRef.current.length < 4) {
        const next = firstPinRef.current + num;
        setFirstPin(next);
        if (next.length === 4) {
          setTimeout(() => {
            setStep(2);
          }, 200);
        }
      }
    } else {
      if (confirmPinRef.current.length < 4) {
        const next = confirmPinRef.current + num;
        setConfirmPin(next);
        if (next.length === 4) {
          setTimeout(() => {
            if (next === firstPinRef.current) {
              onSavePin(next);
            } else {
              setIsShake(true);
              setErrorMsg(language === "EN" ? "PINs do not match. Try again." : "PIN tidak cocok! Silakan coba lagi.");
              setStep(1);
              setFirstPin("");
              setConfirmPin("");
            }
          }, 200);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isShake) setIsShake(false);
    if (step === 1) {
      setFirstPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (isShake) setIsShake(false);
    if (step === 1) {
      setFirstPin("");
    } else {
      setConfirmPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className={`relative w-full max-w-sm bg-[#0e1022] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-5 ${isShake ? "animate-shake" : ""}`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white text-lg w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-all"
        >
          ✕
        </button>

        <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <div>
          <h3 className="text-white text-base font-extrabold">
            {step === 1
              ? (language === "EN" ? "Set Up 4-Digit PIN" : "Buat PIN 4-Digit Baru")
              : (language === "EN" ? "Confirm 4-Digit PIN" : "Konfirmasi PIN 4-Digit Baru")}
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            {step === 1
              ? (language === "EN" ? "Enter 4 numbers for your security PIN" : "Masukkan 4 angka sebagai PIN keamanan Anda")
              : (language === "EN" ? "Re-enter the 4-digit PIN to confirm" : "Masukkan kembali 4 angka PIN untuk konfirmasi")}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 py-1">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = currentInput.length > index;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? "bg-violet-500 border border-violet-300 scale-110 shadow-md shadow-violet-500/50"
                    : "border border-white/30 bg-white/5"
                }`}
              />
            );
          })}
        </div>

        {errorMsg && <p className="text-rose-400 text-xs font-semibold">{errorMsg}</p>}

        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-95 border border-white/10 text-white font-bold text-xl flex items-center justify-center shadow transition-all mx-auto"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-95 border border-white/10 text-white/50 hover:text-white font-semibold text-[10px] flex items-center justify-center transition-all mx-auto uppercase"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-95 border border-white/10 text-white font-bold text-xl flex items-center justify-center shadow transition-all mx-auto"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-95 border border-white/10 text-white/60 hover:text-white font-bold text-base flex items-center justify-center transition-all mx-auto"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}



// ─── Settings Tab Component ───────────────────────────────────────────────────
// ─── Upgraded Settings & Profile Tab Component ─────────────────────────────────
function SettingsTab({
  currentUser,
  currency,
  onCurrencyChange,
  onResetData,
  onLogout,
  onShowToast,
  notificationsEnabled,
  onToggleNotifications,
  transactions = [],
  budget = [],
  events = [],
  onUpdateUser,
  language = "ID",
  onLanguageChange,
  onOpenInstallModal,
  darkMode = true,
  onToggleDarkMode,
  themeColor = "violet",
  onThemeColorChange,
  pinLockEnabled = false,
  onTogglePinLock,
  onOpenSetupPinModal,
}: {
  currentUser: User | null;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  onResetData: () => void;
  onLogout: () => void;
  onShowToast: (msg: string, type: "success" | "info" | "alert") => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  transactions?: Transaction[];
  budget?: BudgetItem[];
  events?: ScheduleEvent[];
  onUpdateUser?: (updatedUser: User) => void;
  language?: Lang;
  onLanguageChange?: (lang: Lang) => void;
  onOpenInstallModal?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: (val: boolean) => void;
  themeColor?: ThemeColor;
  onThemeColorChange?: (col: ThemeColor) => void;
  pinLockEnabled?: boolean;
  onTogglePinLock?: (enabled: boolean) => void;
  onOpenSetupPinModal?: () => void;
}) {
  const [autoBackup, setAutoBackup] = useState(true);

  // OpenRouter API Key state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openrouter_api_key") || "");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState("");

  // Modals
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState(currentUser?.fullName || "");
  const [editEmail, setEditEmail] = useState(currentUser?.email || "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(currentUser?.avatarUrl || "");
  const [editCoverUrl, setEditCoverUrl] = useState(currentUser?.coverUrl || "");

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.fullName || "");
      setEditEmail(currentUser.email || "");
      setEditAvatarUrl(currentUser.avatarUrl || "");
      setEditCoverUrl(currentUser.coverUrl || "");
    }
  }, [currentUser]);

  // Export Data JSON
  const handleExportData = () => {
    try {
      const backupData = {
        app: "Mobile Finance Tracker Pro",
        version: "2.4.0",
        exportedAt: new Date().toISOString(),
        user: currentUser,
        transactions,
        budget,
        events,
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `FinanceTracker_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      onShowToast("Backup data transaksi & jadwal berhasil di-export!", "success");
    } catch {
      onShowToast("Gagal melakukan export data.", "alert");
    }
  };

  // Save Profile Handler
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      onShowToast("Nama tidak boleh kosong", "alert");
      return;
    }
    const updated: User = {
      id: currentUser?.id || "u1",
      email: editEmail.trim() || currentUser?.email || "user@email.com",
      fullName: editName.trim(),
      currency: currency,
      avatarUrl: editAvatarUrl.trim() || undefined,
      coverUrl: editCoverUrl.trim() || undefined,
    };
    if (onUpdateUser) {
      onUpdateUser(updated);
    }
    setShowEditProfileModal(false);
    onShowToast("Profil & background berhasil diperbarui ✨", "success");
  };

  return (
    <div className="tab-scroll h-full px-4 py-5 space-y-5 animate-fade-in pb-24 text-center">
      {/* User Profile Hero Card with Customizable Cover Background */}
      <div className="rounded-3xl relative overflow-hidden shadow-2xl hero-profile-card border border-white/15 bg-[#0e1026]/90 backdrop-blur-2xl transition-all duration-300">
        {/* Cover Background Banner Section */}
        <div className="h-32 sm:h-36 w-full relative overflow-hidden bg-gradient-to-r from-violet-900/80 via-indigo-900/80 to-purple-900/80">
          {currentUser?.coverUrl ? (
            <img
              src={currentUser.coverUrl}
              alt="Profile Cover Background"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full relative overflow-hidden bg-gradient-to-r from-violet-600/30 via-indigo-600/30 to-sky-600/30">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-violet-500/40 rounded-full blur-2xl animate-pulse" />
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-sky-500/40 rounded-full blur-2xl animate-pulse" />
            </div>
          )}
          {/* Bottom Gradient Fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1026] via-black/20 to-transparent" />

          {/* Quick Cover Edit Shortcut */}
          <button
            type="button"
            onClick={() => {
              setEditName(currentUser?.fullName || "");
              setEditEmail(currentUser?.email || "");
              setEditAvatarUrl(currentUser?.avatarUrl || "");
              setEditCoverUrl(currentUser?.coverUrl || "");
              setShowEditProfileModal(true);
            }}
            className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white/80 hover:text-white text-[10px] font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 z-20 cursor-pointer"
            title="Ubah Background Cover"
          >
            <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Ganti Cover</span>
          </button>
        </div>

        {/* Profile Content Body */}
        <div className="px-5 pb-5 relative z-10 flex flex-col items-center justify-center text-center">
          {/* Overlapping Avatar Ring */}
          <div className="-mt-12 sm:-mt-14 mb-3 relative flex-shrink-0 mx-auto group z-20">
            <div className="w-22 h-22 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-600 to-sky-500 p-0.5 shadow-2xl relative overflow-hidden border-4 border-[#0e1026]">
              <div className="w-full h-full rounded-[12px] bg-[#0c0e21] flex items-center justify-center text-2xl font-black text-white preserve-white shadow-inner overflow-hidden relative">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="w-full h-full object-cover" />
                ) : (
                  currentUser?.fullName ? currentUser.fullName.substring(0, 2).toUpperCase() : "M"
                )}
              </div>
            </div>

            {/* Status Badge */}
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0e1026] flex items-center justify-center text-[10px] text-white preserve-white font-bold z-10 shadow-md" title="Akun Aktif">
              ✓
            </span>
          </div>

          {/* User Info Stack */}
          <div className="flex flex-col items-center justify-center text-center space-y-1.5 w-full">
            <div className="inline-flex items-center justify-center gap-2 flex-wrap">
              <h3 className="text-white font-extrabold text-lg tracking-tight text-center">
                {currentUser?.fullName || (language === "EN" ? "User" : "Pengguna")}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm flex items-center gap-1">
                <span>✦</span>
                <span>Pro Tier</span>
              </span>
            </div>

            <p className="text-slate-300 text-xs font-mono text-center bg-white/5 border border-white/10 px-3 py-0.5 rounded-full inline-block">
              {currentUser?.email || "user@email.com"}
            </p>

            <div className="pt-0.5">
              <span className="text-[11px] text-violet-300 bg-violet-500/15 px-3 py-1 rounded-xl border border-violet-500/30 font-semibold shadow-sm inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span>Personal Finance Account</span>
              </span>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex items-center justify-center gap-3 w-full max-w-xs pt-4 mt-1">
            <button
              type="button"
              onClick={() => {
                setEditName(currentUser?.fullName || "");
                setEditEmail(currentUser?.email || "");
                setEditAvatarUrl(currentUser?.avatarUrl || "");
                setEditCoverUrl(currentUser?.coverUrl || "");
                setShowEditProfileModal(true);
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/50 text-violet-200 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>{t("edit_profile", language)}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t("logout", language)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Financial Telemetry Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-3.5 border border-white/10 flex flex-col items-center text-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider text-center">{t("nav_transactions", language)}</p>
            <p className="text-white font-extrabold text-sm mt-0.5 text-center">{transactions.length} {t("items", language)}</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-3.5 border border-white/10 flex flex-col items-center text-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 8v2m0-10c-2.209 0-4 1.791-4 4s1.791 4 4 4 4 1.791 4 4-1.791 4-4 4m0-12a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
          </div>
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider text-center">{t("nav_budget", language)}</p>
            <p className="text-white font-extrabold text-sm mt-0.5 text-center">{budget.length} {t("categories", language)}</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-3.5 border border-white/10 flex flex-col items-center text-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider text-center">{t("nav_schedule", language)}</p>
            <p className="text-white font-extrabold text-sm mt-0.5 text-center">{events.length} {t("agenda", language)}</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-3.5 border border-white/10 flex flex-col items-center text-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider text-center">{t("pin_lock", language).split(" ")[0]} PIN</p>
            <p className="text-white font-extrabold text-sm mt-0.5 text-center">{pinLockEnabled ? t("active", language) : t("inactive", language)}</p>
          </div>
        </div>
      </div>

      {/* Category 1: Preferensi Aplikasi */}
      <div className="glass-card rounded-2xl p-4 space-y-4 border border-white/10">
        <div className="flex items-center justify-center gap-2 border-b border-white/5 pb-2 text-center">
          <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider">{t("app_preferences", language)}</h4>
        </div>

        {/* Currency */}
        <div className="flex flex-row items-center justify-between gap-3 py-1 text-left">
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">{t("main_currency", language)}</p>
            <p className="text-white/40 text-[11px]">{t("currency_sub", language)}</p>
          </div>
          <div className="shrink-0">
            <CustomDropdown<Currency>
              value={currency}
              options={[
                { value: "IDR", label: "IDR (Rupiah)", icon: "🇮🇩" },
                { value: "USD", label: "USD ($ Dollar)", icon: "🇺🇸" },
                { value: "SGD", label: "SGD (S$ Dollar)", icon: "🇸🇬" },
                { value: "EUR", label: "EUR (€ Euro)", icon: "🇪🇺" },
              ]}
              onChange={(val) => {
                onCurrencyChange(val);
                onShowToast(`Mata uang utama diubah ke ${val}`, "info");
              }}
            />
          </div>
        </div>

        {/* Permanent Dark Mode Indicator */}
        <div className="flex flex-row items-center justify-between gap-3 py-2 border-t border-white/5 text-left">
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">{t("visual_theme", language)}</p>
            <p className="text-white/40 text-[11px]">Dark Glassmorphism UI (Standar Permanent)</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-[11px] font-bold shadow-sm flex items-center gap-1.5">
              <span>🌙</span>
              <span>Dark Mode</span>
            </span>
          </div>
        </div>

        {/* Theme Accent Color Selection Palette */}
        <div className="py-2.5 border-t border-white/5 space-y-2 text-left">
          <div className="flex flex-row items-center justify-between gap-2 text-left">
            <div className="text-left flex-1 min-w-0">
              <p className="text-white text-xs font-semibold">{t("theme_color_title", language)}</p>
              <p className="text-white/40 text-[11px]">{t("theme_color_sub", language)}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${THEME_STYLES[themeColor].bgBadge}`}>
              {THEME_STYLES[themeColor].name}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 pt-1">
            {(
              [
                { id: "violet", name: "Violet", bg: "bg-violet-600" },
                { id: "emerald", name: "Emerald", bg: "bg-emerald-500" },
                { id: "ocean", name: "Ocean", bg: "bg-cyan-500" },
                { id: "amber", name: "Amber", bg: "bg-amber-500" },
                { id: "rose", name: "Rose", bg: "bg-rose-500" },
              ] as const
            ).map((tItem) => {
              const active = themeColor === tItem.id;
              return (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => {
                    if (onThemeColorChange) onThemeColorChange(tItem.id);
                    onShowToast(`Warna aksen tema diubah ke ${tItem.name} ✨`, "info");
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 border ${
                    active
                      ? "bg-white/10 border-white/40 shadow-lg scale-105"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full ${tItem.bg} shadow-md flex items-center justify-center text-white text-[11px] transition-transform duration-300 ${
                      active ? "ring-2 ring-white ring-offset-2 ring-offset-[#0b0c16] scale-110" : "hover:scale-105 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {active && <i className="fa-solid fa-check text-xs" />}
                  </div>
                  <span className={`text-[10px] font-extrabold ${active ? "text-white" : "text-white/40"}`}>
                    {tItem.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language */}
        <div className="flex flex-row items-center justify-between gap-3 py-1 border-t border-white/5 text-left">
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">{t("system_language", language)}</p>
            <p className="text-white/40 text-[11px]">{t("system_language_sub", language)}</p>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => {
                if (onLanguageChange) onLanguageChange("ID");
                onShowToast("Bahasa diatur ke Indonesia", "info");
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                language === "ID" ? "bg-violet-600 text-white shadow-md" : "text-white/40 hover:text-white"
              }`}
            >
              🇮🇩 ID
            </button>
            <button
              onClick={() => {
                if (onLanguageChange) onLanguageChange("EN");
                onShowToast("Language set to English", "info");
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                language === "EN" ? "bg-violet-600 text-white shadow-md" : "text-white/40 hover:text-white"
              }`}
            >
              🇺🇸 EN
            </button>
          </div>
        </div>
      </div>

      {/* Category 2: Notifikasi & Keamanan */}
      <div className="glass-card rounded-2xl p-4 space-y-4 border border-white/10">
        <div className="flex items-center justify-center gap-2 border-b border-white/5 pb-2 text-center">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider">{t("notifications_sec", language)}</h4>
        </div>

        {/* Notifications Switch */}
        <div className="flex flex-row items-center justify-between gap-3 py-1 text-left">
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">{t("push_notif", language)}</p>
            <p className="text-white/40 text-[11px]">{t("push_notif_sub", language)}</p>
          </div>
          <ToggleSwitch value={notificationsEnabled} onChange={onToggleNotifications} />
        </div>

        {/* Cloud Auto-Backup */}
        <div className="flex flex-row items-center justify-between gap-3 py-1 border-t border-white/5 text-left">
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">{t("cloud_sync", language)}</p>
            <p className="text-white/40 text-[11px]">{t("cloud_sync_sub", language)}</p>
          </div>
          <ToggleSwitch
            value={autoBackup}
            onChange={(val) => {
              setAutoBackup(val);
              onShowToast(val ? "Auto-sync ke server diaktifkan ☁️" : "Auto-sync dinonaktifkan", "info");
            }}
          />
        </div>

        {/* 4-Digit PIN Lock Switch */}
        <div className="flex flex-row items-center justify-between gap-3 py-1 border-t border-white/5 text-left">
          <div className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-xs font-semibold">{t("pin_lock", language)}</p>
              {pinLockEnabled && (
                <button
                  type="button"
                  onClick={onOpenSetupPinModal}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-bold underline bg-violet-500/10 hover:bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-500/20 transition-all cursor-pointer"
                >
                  {t("change_pin", language)}
                </button>
              )}
            </div>
            <p className="text-white/40 text-[11px] mt-0.5">{t("pin_lock_sub", language)}</p>
          </div>
          <ToggleSwitch
            value={pinLockEnabled}
            onChange={(val) => {
              if (onTogglePinLock) onTogglePinLock(val);
            }}
          />
        </div>
      </div>

      {/* Category 3: OpenRouter AI Key Configuration */}
      <div className="glass-card rounded-2xl p-4 space-y-3 border border-violet-500/20 bg-gradient-to-r from-violet-950/20 to-indigo-950/20">
        <div className="flex items-center justify-center gap-2 border-b border-white/5 pb-2 text-center">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider">{t("ai_config_title", language)}</h4>
        </div>

        <div className="flex flex-row items-center justify-between gap-3 text-left">
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">{t("ai_key_status", language)}</p>
            <p className="text-white/50 text-[11px]">
              {apiKey ? t("key_active", language) : t("key_inactive", language)}
            </p>
          </div>

          <button
            onClick={() => {
              setTempKeyInput(apiKey);
              setShowApiKeyModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-violet-600/30 border border-violet-500/40 text-violet-200 text-xs font-bold hover:bg-violet-600/50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
          >
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span>{apiKey ? t("manage_key", language) : t("set_key", language)}</span>
          </button>
        </div>
      </div>

      {/* Category: Aplikasi Web (PWA Install Prompt) */}
      <div className="glass-card rounded-2xl p-4 space-y-3 border border-indigo-500/20 bg-gradient-to-r from-indigo-950/20 to-purple-950/20">
        <div className="flex items-center justify-center gap-2 border-b border-white/5 pb-2 text-center">
          <i className="fa-solid fa-mobile-screen-button text-indigo-400 text-sm" />
          <h4 className="text-white font-bold text-xs uppercase tracking-wider">Aplikasi Web (PWA)</h4>
        </div>

        <div className="flex flex-row items-center justify-between gap-3 text-left">
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">Install Aplikasi di Perangkat</p>
            <p className="text-white/50 text-[11px]">
              Akses cepat tanpa browser, responsif & pengalaman layaknya native app
            </p>
          </div>

          <button
            onClick={() => {
              if (onOpenInstallModal) onOpenInstallModal();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:shadow-lg hover:shadow-violet-600/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 border border-white/10 shrink-0"
          >
            <i className="fa-solid fa-download text-xs" />
            <span>Install PWA</span>
          </button>
        </div>
      </div>

      {/* Category 4: Backup & Manajemen Data */}
      <div className="glass-card rounded-2xl p-4 space-y-3 border border-white/10">
        <div className="flex items-center justify-center gap-2 border-b border-white/5 pb-2 text-center">
          <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider">{t("data_backup_title", language)}</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Export JSON Backup */}
          <button
            onClick={handleExportData}
            className="w-full py-2.5 px-3 rounded-xl glass border border-white/15 text-white text-xs font-bold hover:bg-white/10 hover:border-sky-400 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 group"
          >
            <svg className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{t("export_json", language)}</span>
          </button>

          {/* Import JSON Backup */}
          <label className="w-full py-2.5 px-3 rounded-xl glass border border-white/15 text-white text-xs font-bold hover:bg-white/10 hover:border-indigo-400 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 group">
            <svg className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
            </svg>
            <span>{t("import_json", language)}</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const fileReader = new FileReader();
                if (e.target.files && e.target.files[0]) {
                  fileReader.readAsText(e.target.files[0], "UTF-8");
                  fileReader.onload = (event) => {
                    try {
                      const parsed = JSON.parse(event.target?.result as string);
                      if (parsed.transactions && Array.isArray(parsed.transactions)) {
                        localStorage.setItem("mft_transactions", JSON.stringify(parsed.transactions));
                      }
                      if (parsed.budget && Array.isArray(parsed.budget)) {
                        localStorage.setItem("mft_budget", JSON.stringify(parsed.budget));
                      }
                      if (parsed.events && Array.isArray(parsed.events)) {
                        localStorage.setItem("mft_events", JSON.stringify(parsed.events));
                      }
                      onShowToast("Data berhasil dipulihkan! Halaman akan memuat ulang.", "success");
                      setTimeout(() => window.location.reload(), 1200);
                    } catch {
                      onShowToast("File backup tidak valid atau rusak.", "alert");
                    }
                  };
                }
              }}
            />
          </label>
        </div>

        {/* Danger Zone: Clear Data */}
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={onResetData}
            className="w-full py-2.5 rounded-xl text-rose-400 font-bold text-xs transition-all border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center gap-2 shadow-sm active:scale-95"
          >
            <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{t("reset_button", language)}</span>
          </button>
        </div>
      </div>

      {/* Category 5: Informasi & Bantuan */}
      <div className="glass-card rounded-2xl p-4 space-y-3 border border-white/10">
        <div className="flex items-center justify-center gap-2 border-b border-white/5 pb-2 text-center">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider">{t("info_help_title", language)}</h4>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-white/50 pt-1 text-center">
          <span>Pengembang & Arsitektur</span>
          <span className="font-semibold text-white/80">Mobile Finance Tracker AI</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-white/50 text-center">
          <span>{t("version_info", language)}</span>
          <span className="font-mono text-violet-300 font-bold">2.4.0 (Build 2026.08)</span>
        </div>
        <div className="pt-2 text-center">
          <button
            onClick={() => setShowFaqModal(true)}
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold underline"
          >
            {t("faq_center", language)}
          </button>
        </div>
      </div>

      {/* Confirm Logout Alert Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title={language === "EN" ? "Confirm Logout" : "Konfirmasi Logout"}
        message={
          language === "EN"
            ? "Are you sure you want to log out from your account? Your local active session will be ended."
            : "Apakah Anda yakin ingin keluar dari akun? Sesi pengguna Anda akan diakhiri."
        }
        confirmText={language === "EN" ? "Yes, Logout" : "Ya, Logout"}
        cancelText={language === "EN" ? "Cancel" : "Batal"}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Edit Profile Modal (Portal) */}
      {showEditProfileModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-sm glass-card rounded-3xl p-5 border border-violet-500/40 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Edit Informasi Profil</span>
                </h3>
                <button onClick={() => setShowEditProfileModal(false)} className="text-white/40 hover:text-white transition-colors">✕</button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Photo Preview & Manual URL Section */}
                <div className="flex flex-col items-center justify-center gap-2 py-2 bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-600 to-sky-500 p-0.5 shadow-xl overflow-hidden">
                      <div className="w-full h-full rounded-[14px] bg-[#0c0e21] flex items-center justify-center text-2xl font-black text-white preserve-white overflow-hidden relative">
                        {editAvatarUrl ? (
                          <img src={editAvatarUrl} alt="Preview Avatar" className="w-full h-full object-cover" />
                        ) : (
                          editName ? editName.substring(0, 2).toUpperCase() : "M"
                        )}
                      </div>
                    </div>
                  </div>

                  {editAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAvatarUrl("")}
                      className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                    >
                      Hapus URL Foto
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-white/40 text-[10px] uppercase font-bold tracking-wider">URL Foto Profil (Direct Image Link)</label>
                  <input
                    type="text"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 font-mono"
                    placeholder="https://example.com/foto.jpg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/40 text-[10px] uppercase font-bold tracking-wider">URL Cover Background (Gambar Header)</label>
                  <input
                    type="text"
                    value={editCoverUrl}
                    onChange={(e) => setEditCoverUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 font-mono"
                    placeholder="https://example.com/cover-background.jpg"
                  />
                  {/* Preset Background Themes */}
                  <div className="pt-1 space-y-1">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Preset Cover Background:</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEditCoverUrl("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80")}
                        className="px-2 py-0.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-[10px] font-semibold transition-all"
                      >
                        🔮 Cyberpunk
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCoverUrl("https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=800&q=80")}
                        className="px-2 py-0.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-[10px] font-semibold transition-all"
                      >
                        🌌 Deep Space
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCoverUrl("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80")}
                        className="px-2 py-0.5 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] font-semibold transition-all"
                      >
                        ⚡ Neon Wave
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCoverUrl("")}
                        className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white/60 text-[10px] font-semibold transition-all"
                      >
                        ↺ Default Gradient
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Nama Lengkap</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                    placeholder="Nama Lengkap"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Alamat Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                    placeholder="email@domain.com"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditProfileModal(false)}
                    className="px-3.5 py-2 rounded-xl glass text-xs font-semibold text-white/70 hover:text-white transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* FAQ & Help Center Modal (Portal) */}
      {showFaqModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-md glass-card rounded-3xl p-5 border border-violet-500/40 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Pusat Bantuan & FAQ</span>
                </h3>
                <button onClick={() => setShowFaqModal(false)} className="text-white/40 hover:text-white">✕</button>
              </div>

              <div className="space-y-3 text-xs text-white/80">
                <div className="p-3 rounded-2xl glass border border-white/10 space-y-1">
                  <p className="font-bold text-violet-300">💡 Bagaimana cara mengaktifkan AI Assistant Chat?</p>
                  <p className="text-white/60 text-[11px] leading-relaxed">
                    Masuk ke menu Profil atau tab AI Chat, klik "Atur API Key", lalu tempelkan OPENROUTER_API_KEY gratis Anda dari openrouter.ai.
                  </p>
                </div>

                <div className="p-3 rounded-2xl glass border border-white/10 space-y-1">
                  <p className="font-bold text-violet-300">🔒 Apakah data keuangan saya aman?</p>
                  <p className="text-white/60 text-[11px] leading-relaxed">
                    Ya, data Anda disimpan di LocalStorage perangkat lokal dan tersinkronisasi secara aman melalui REST API Server internal.
                  </p>
                </div>

                <div className="p-3 rounded-2xl glass border border-white/10 space-y-1">
                  <p className="font-bold text-violet-300">📦 Bagaimana cara mencadangkan (backup) data?</p>
                  <p className="text-white/60 text-[11px] leading-relaxed">
                    Klik tombol "Export Backup (JSON)" di bagian Backup Data untuk mendownload salinan utuh transaksi & jadwal Anda.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowFaqModal(false)}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-md hover:bg-violet-500 transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* OpenRouter API Key Modal (Portal) */}
      {showApiKeyModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-sm glass-card rounded-3xl p-5 border border-violet-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>Konfigurasi OpenRouter API Key</span>
                </h3>
                <button onClick={() => setShowApiKeyModal(false)} className="text-white/40 hover:text-white">✕</button>
              </div>

              <p className="text-white/60 text-xs leading-relaxed">
                Dapatkan API Key gratis di{" "}
                <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer" className="text-violet-400 underline font-semibold">
                  openrouter.ai
                </a>{" "}
                untuk mengaktifkan fitur AI Assistant.
              </p>

              <div className="space-y-1">
                <label className="text-white/40 text-[10px] uppercase font-bold tracking-wider">API Key</label>
                <input
                  type="password"
                  value={tempKeyInput}
                  onChange={(e) => setTempKeyInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 font-mono"
                  placeholder="sk-or-v1-..."
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {apiKey ? (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("openrouter_api_key");
                      setApiKey("");
                      setTempKeyInput("");
                      setShowApiKeyModal(false);
                      onShowToast("API Key berhasil dihapus", "info");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition-all"
                  >
                    Hapus Key
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(false)}
                    className="px-3.5 py-2 rounded-xl glass text-xs font-semibold text-white/70 hover:text-white transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = tempKeyInput.trim();
                      if (!trimmed) {
                        onShowToast("API Key tidak boleh kosong", "alert");
                        return;
                      }
                      localStorage.setItem("openrouter_api_key", trimmed);
                      setApiKey(trimmed);
                      setShowApiKeyModal(false);
                      onShowToast("API Key berhasil disimpan! AI Chat siap digunakan 🚀", "success");
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95"
                  >
                    Simpan Key
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── OpenRouter Free Models List ─────────────────────────────────────────────
const OPENROUTER_MODELS = [
  { value: "dots-studio/dots-3-note-preview:free", label: "DOTS-3 Note Preview (Gratis)", provider: "DOTS Studio", titleBold: "DOTS-3", titleMuted: "Note" },
  { value: "liquid/lfm-2.5-2.6b:free", label: "LFM 2.5 2.6B (Gratis)", provider: "Liquid", titleBold: "LFM 2.5", titleMuted: "2.6B" },
  { value: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning (Gratis)", provider: "NVIDIA", titleBold: "Nemotron", titleMuted: "3.5" },
  { value: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B (Gratis)", provider: "NVIDIA", titleBold: "Nemotron", titleMuted: "3 Super" },
  { value: "thinkingmachines/inkling-small:free", label: "Inkling Small (Gratis)", provider: "Thinking Machines", titleBold: "Inkling", titleMuted: "Small" },
  { value: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1 (Gratis)", provider: "Poolside", titleBold: "Laguna", titleMuted: "S 2.1" },
  { value: "z-ai/glm-5.2:free", label: "GLM 5.2 (Gratis)", provider: "Z-AI", titleBold: "GLM", titleMuted: "5.2" },
  { value: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B A4B (Gratis)", provider: "Google", titleBold: "Gemma 4", titleMuted: "26B A4B" },
  { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (Gratis)", provider: "Google", titleBold: "Gemma 4", titleMuted: "31B" },
  { value: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (Gratis - High Reasoning)", provider: "Meta", titleBold: "Llama", titleMuted: "3.3 70B" },
  { value: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (Gratis)", provider: "Meta", titleBold: "Llama", titleMuted: "3.1 8B" },
  { value: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (Gratis - Deep Analysis)", provider: "DeepSeek", titleBold: "DeepSeek", titleMuted: "R1" },
  { value: "deepseek/deepseek-chat:free", label: "DeepSeek V3 Chat (Gratis)", provider: "DeepSeek", titleBold: "DeepSeek", titleMuted: "V3" },
  { value: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B (Gratis - Comprehensive)", provider: "Alibaba", titleBold: "Qwen", titleMuted: "2.5 72B" },
  { value: "qwen/qwen-2.5-coder-32b-instruct:free", label: "Qwen 2.5 Coder 32B (Gratis)", provider: "Alibaba", titleBold: "Qwen", titleMuted: "Coder 32B" },
  { value: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B Instruct (Gratis)", provider: "Mistral", titleBold: "Mistral", titleMuted: "7B" },
  { value: "microsoft/phi-3-medium-128k-instruct:free", label: "Phi-3 Medium 128k (Gratis)", provider: "Microsoft", titleBold: "Phi-3", titleMuted: "Medium" },
  { value: "nousresearch/hermes-3-llama-3.1-405b:free", label: "Hermes 3 405B (Gratis)", provider: "Nous", titleBold: "Hermes", titleMuted: "3 405B" },
  { value: "openchat/openchat-7b:free", label: "OpenChat 7B (Gratis)", provider: "OpenChat", titleBold: "OpenChat", titleMuted: "7B" },
  { value: "gryphe/mythomax-l2-13b:free", label: "MythoMax 13B (Gratis)", provider: "Gryphe", titleBold: "MythoMax", titleMuted: "13B" },
];

// ─── Gemini Spark Icon Component ─────────────────────────────────────────────
function GeminiSparkIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="gemini-spark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="35%" stopColor="#818cf8" />
          <stop offset="70%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
      </defs>
      <path
        d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"
        fill="url(#gemini-spark-grad)"
      />
    </svg>
  );
}

// ─── Other Tools & Utilities Hub Modal ──────────────────────────────────────
function OtherToolsModal({
  isOpen,
  onClose,
  onShowToast,
  language = "ID",
}: {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type: "success" | "error" | "info" | "alert") => void;
  language?: Lang;
}) {
  const [activeTool, setActiveTool] = useState<"shinigami" | "anichin" | "bgremove" | "upscale" | "tools_list">("shinigami");

  // Background Removal Tool States
  const [bgImageUrl, setBgImageUrl] = useState("");
  const [bgMode, setBgMode] = useState<"general_v1" | "general_v2" | "logo" | "text" | "anime" | "custom">("general_v1");
  const [bgCustomPrompt, setBgCustomPrompt] = useState("");
  const [bgLoading, setBgLoading] = useState(false);
  const [bgProgress, setBgProgress] = useState<string | null>(null);
  const [bgResult, setBgResult] = useState<{ preview: string; jobId: string; inputUrl: string } | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);

  // Swiftspeed Image Upscaler States
  const [upImageUrl, setUpImageUrl] = useState("");
  const [upScale, setUpScale] = useState<number>(4);
  const [upLoading, setUpLoading] = useState(false);
  const [upProgress, setUpProgress] = useState<string | null>(null);
  const [upResult, setUpResult] = useState<{
    download_url: string;
    original_size?: string;
    processed_size?: string;
    engine?: string;
  } | null>(null);
  const [upError, setUpError] = useState<string | null>(null);

  if (!isOpen) return null;

  // ─── Swiftspeed Image Upscaler helper ──────────────────────────────────────────
  const SWIFTSPEED_API = "https://swiftspeed.app/api/v2/tools/upscale";

  const handleUpscale = async () => {
    if (!upImageUrl.trim()) {
      onShowToast("Masukkan URL gambar terlebih dahulu.", "error");
      return;
    }
    setUpLoading(true);
    setUpResult(null);
    setUpError(null);

    const headers: Record<string, string> = {
      "Origin": "https://swiftspeed.app",
      "Referer": "https://swiftspeed.app/tools/image-upscaler",
    };

    try {
      setUpProgress("📥 Mengunduh gambar target...");
      const imgRes = await fetch(upImageUrl.trim());
      if (!imgRes.ok) throw new Error(`Gagal download gambar (HTTP ${imgRes.status})`);
      const ab = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      let fileName = "upscale_target.jpg";
      try { fileName = new URL(upImageUrl).pathname.split("/").filter(Boolean).pop() || "upscale_target.jpg"; } catch { /**/ }

      setUpProgress("📤 Mengirim gambar ke Swiftspeed AI...");
      const form = new FormData();
      form.append("file", new Blob([ab], { type: contentType }), fileName);
      form.append("scale", upScale.toString());

      const createRes = await fetch(SWIFTSPEED_API, {
        method: "POST",
        headers,
        body: form,
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData?.job_id) {
        throw new Error(createData?.message || createData?.error || "Gagal mendapatkan job_id dari Swiftspeed server.");
      }
      const jobId = createData.job_id;

      setUpProgress("⏳ Memproses upscale gambar (RealESRGAN)...");
      const statusUrl = `${SWIFTSPEED_API}/status/${jobId}`;
      let processedResult: any = null;

      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const pollRes = await fetch(statusUrl, { headers });
          if (pollRes.ok) {
            const data = await pollRes.json();
            if (data.status === "done") {
              const res = data.results?.[0];
              if (res && res.download_url) {
                const fullDownloadUrl = res.download_url.startsWith("http")
                  ? res.download_url
                  : `https://swiftspeed.app${res.download_url}`;
                processedResult = {
                  download_url: fullDownloadUrl,
                  original_size: res.original_size,
                  processed_size: res.processed_size,
                  engine: res.engine || "realesrgan",
                };
                break;
              }
            }
          }
        } catch {
          // Retry polling
        }
      }

      if (!processedResult) {
        throw new Error("Timeout: Proses upscale terlalu lama.");
      }

      setUpResult(processedResult);
      setUpProgress(null);
      setUpLoading(false);
      onShowToast("Gambar berhasil di-upscale! ✨", "success");
    } catch (err: any) {
      setUpProgress(null);
      setUpLoading(false);
      const msg = err.message || "Terjadi kesalahan saat upscale.";
      setUpError(msg);
      onShowToast(msg, "error");
    }
  };

  const BG_API = "https://api.ezremove.ai/api/ez-remove/v3/background-remove";
  const BG_MODES = [
    { value: "general_v1", label: "General V1 (Fast)" },
    { value: "general_v2", label: "General V2 (Precision)" },
    { value: "logo", label: "Logo / Badge" },
    { value: "text", label: "Text Isolate" },
    { value: "anime", label: "Anime / Cartoon" },
    { value: "custom", label: "Custom Prompt" },
  ];

  const handleBgRemove = async () => {
    if (!bgImageUrl.trim()) {
      onShowToast("Masukkan URL gambar terlebih dahulu.", "error");
      return;
    }
    setBgLoading(true);
    setBgResult(null);
    setBgError(null);

    // Generate random serial
    let serial = "";
    for (let i = 0; i < 32; i++) serial += Math.floor(Math.random() * 16).toString(16);
    const baseHeaders: Record<string, string> = {
      "Product-Serial": serial,
      "Origin": "https://ezremove.ai",
      "Referer": "https://ezremove.ai/",
    };

    try {
      // 1. Download image
      setBgProgress("📥 Mengunduh gambar...");
      const imgRes = await fetch(bgImageUrl.trim());
      if (!imgRes.ok) throw new Error(`Gagal download gambar (HTTP ${imgRes.status})`);
      const ab = await imgRes.arrayBuffer();
      const imageBytes = new Uint8Array(ab);
      const contentType = imgRes.headers.get("content-type") || "image/png";
      let fileName = "input.png";
      try { fileName = new URL(bgImageUrl).pathname.split("/").filter(Boolean).pop() || "input.png"; } catch { /**/ }

      // 2. Create job
      setBgProgress("📤 Membuat job background removal...");
      const form = new FormData();
      form.append("image_file", new Blob([imageBytes], { type: contentType }), fileName);
      form.append("mode", bgMode);
      if (bgMode === "custom" && bgCustomPrompt.trim()) {
        form.append("params", JSON.stringify({ prompt: bgCustomPrompt.trim() }));
      }
      const createRes = await fetch(`${BG_API}/create-job`, { method: "POST", headers: baseHeaders, body: form });
      const createData = await createRes.json();
      if (createRes.status !== 200 || !createData?.result?.job_id) {
        throw new Error(`Create job gagal: ${JSON.stringify(createData).slice(0, 200)}`);
      }
      const jobId: string = createData.result.job_id;
      const inputUrl: string = createData.result.image_url;

      // 3. Poll for result (max 40s)
      setBgProgress("⏳ Memproses gambar di server...");
      const startedAt = Date.now();
      let delay = 1200;
      let pollResult: any = null;
      while (Date.now() - startedAt < 40000) {
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay + 500, 3000);
        try {
          const pollRes = await fetch(`${BG_API}/get-job/${jobId}`, { headers: baseHeaders });
          if (!pollRes.ok) continue;
          const pollData = await pollRes.json();
          const status = pollData?.result?.status;
          if (status === 2) { pollResult = pollData.result; break; }
          if (status === 3) throw new Error(`Server error: ${pollData?.result?.error ?? "unknown"}`);
        } catch (pe: any) { if (pe.message?.includes("Server error")) throw pe; }
      }
      if (!pollResult) throw new Error("Timeout: server terlalu lama memproses (>40s). Coba lagi.");

      const preview = Array.isArray(pollResult.output?.preview) ? pollResult.output.preview[0] : null;
      if (!preview) throw new Error("Tidak ada output preview dari server.");

      setBgResult({ preview, jobId, inputUrl });
      setBgProgress(null);
      setBgLoading(false);
      onShowToast("Background berhasil dihapus! 🎨", "success");
    } catch (err: any) {
      setBgProgress(null);
      setBgLoading(false);
      const msg = err.message || "Terjadi kesalahan.";
      setBgError(msg);
      onShowToast(msg, "error");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 md:p-6 animate-fade-in font-sans">
      {/* Dark Glass Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Modal Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0c0e1e] border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 text-slate-100 animate-scale-up">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-violet-950/30 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white text-lg shadow-lg shadow-emerald-500/20">
              <i className="fa-solid fa-toolbox" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-base md:text-lg tracking-tight flex items-center gap-2">
                <span>Tools & Utility Hub</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
                  v1.0
                </span>
              </h2>
              <p className="text-white/50 text-xs">Perkakas & layanan tambahan serbaguna</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Nav Bar */}
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="px-5 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap"
        >
          <button
            onClick={() => setActiveTool("shinigami")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTool === "shinigami"
                ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-500/20"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-book-open text-rose-300" />
            <span>Shinigami Manga Reader</span>
          </button>

          <button
            onClick={() => setActiveTool("anichin")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTool === "anichin"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-play text-cyan-300" />
            <span>Anichin Donghua Streamer</span>
          </button>

          <button
            onClick={() => setActiveTool("bgremove")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTool === "bgremove"
                ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-500/20"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-eraser text-sky-300" />
            <span>Background Removal</span>
          </button>

          <button
            onClick={() => { setActiveTool("upscale"); setUpResult(null); setUpError(null); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTool === "upscale"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-wand-magic-sparkles text-emerald-300" />
            <span>Image Upscaler</span>
          </button>

          <button
            onClick={() => setActiveTool("tools_list")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTool === "tools_list"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-grid-2 text-violet-300" />
            <span>Daftar Utility</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 tab-scroll">
          {activeTool === "shinigami" && (
            <ShinigamiReader onShowToast={onShowToast} onCloseModal={onClose} />
          )}

          {activeTool === "anichin" && (
            <AnichinStreamer onShowToast={onShowToast} onCloseModal={onClose} />
          )}

          {activeTool === "bgremove" && (
            <div className="space-y-5 animate-fade-in">
              {/* Banner */}
              <div className="relative rounded-2xl p-4 overflow-hidden border border-sky-500/30 bg-gradient-to-r from-sky-950/50 via-cyan-950/40 to-slate-900">
                <div className="relative z-10 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 text-2xl flex-shrink-0">
                    <i className="fa-solid fa-wand-magic-sparkles" />
                  </div>
                  <div>
                    <h3 className="text-white font-extrabold text-sm md:text-base">AI Background Removal</h3>
                    <p className="text-white/70 text-xs leading-relaxed mt-1">
                      Hapus background gambar secara otomatis menggunakan AI ezremove.ai. Dukung 6 mode: General, Logo, Text, Anime, dan Custom Prompt.
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Card */}
              <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-4">
                {/* URL Input */}
                <div className="space-y-1.5">
                  <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider block">URL Gambar</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-...?w=512&h=512&fit=crop"
                    value={bgImageUrl}
                    onChange={(e) => { setBgImageUrl(e.target.value); setBgError(null); setBgResult(null); }}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <p className="text-white/30 text-[10px]">Gunakan URL gambar publik langsung (hindari redirect link).</p>
                </div>

                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider block">Mode AI</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BG_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setBgMode(m.value as typeof bgMode)}
                        className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all border ${
                          bgMode === m.value
                            ? "bg-gradient-to-r from-sky-600 to-cyan-600 text-white border-sky-400/40 shadow-md"
                            : "border-white/10 text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Prompt Input */}
                {bgMode === "custom" && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider block">Custom Erase Prompt</label>
                    <input
                      type="text"
                      placeholder="misal: remove background watermark, isolate character..."
                      value={bgCustomPrompt}
                      onChange={(e) => setBgCustomPrompt(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-500 font-sans"
                    />
                    <p className="text-white/30 text-[10px]">Masukkan instruksi prompt spesifik untuk AI eraser.</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleBgRemove}
                  disabled={bgLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bgLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Memproses...</span></>
                  ) : (
                    <><i className="fa-solid fa-eraser" /><span>Hapus Background</span></>
                  )}
                </button>
              </div>

              {/* Progress Indicator */}
              {bgLoading && bgProgress && (
                <div className="p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-950/30 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-xs text-cyan-300 font-mono">{bgProgress}</span>
                </div>
              )}

              {/* Error */}
              {bgError && !bgLoading && (
                <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-950/40 text-xs text-rose-200 flex items-start gap-2 animate-slide-up">
                  <i className="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold mb-0.5">❌ Gagal</p>
                    <p className="text-rose-300/80">{bgError}</p>
                  </div>
                </div>
              )}

              {/* Result */}
              {bgResult && !bgLoading && (
                <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 space-y-3 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-emerald-300 font-bold text-xs flex items-center gap-2">
                      <i className="fa-solid fa-check-circle" />
                      <span>Background Removed ✅</span>
                    </h4>
                    <span className="text-white/30 text-[10px] font-mono">mode: {bgMode}</span>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-[repeating-conic-gradient(#ffffff10_0%_25%,transparent_0%_50%)] bg-[size:16px_16px]">
                    <img
                      src={bgResult.preview}
                      alt="Result"
                      className="w-full object-contain max-h-64"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Preview URL</p>
                    <a
                      href={bgResult.preview}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] font-mono text-sky-400 hover:text-sky-300 break-all bg-white/5 rounded-lg px-2 py-1.5 border border-white/10 hover:border-sky-500/30 transition-colors"
                    >
                      {bgResult.preview}
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={bgResult.preview}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:from-emerald-500 hover:to-teal-500 transition-all active:scale-95"
                    >
                      <i className="fa-solid fa-download" />
                      <span>Download</span>
                    </a>
                    <button
                      onClick={() => { setBgResult(null); setBgImageUrl(""); }}
                      className="px-4 py-2 rounded-xl border border-white/15 text-white/60 hover:text-white hover:bg-white/10 text-xs font-bold transition-all"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTool === "upscale" && (
            <div className="space-y-5 animate-fade-in">
              {/* Banner */}
              <div className="relative rounded-2xl p-4 overflow-hidden border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-slate-900">
                <div className="relative z-10 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl flex-shrink-0">
                    <i className="fa-solid fa-wand-magic-sparkles" />
                  </div>
                  <div>
                    <h3 className="text-white font-extrabold text-sm md:text-base">Swiftspeed AI Image Upscaler</h3>
                    <p className="text-white/70 text-xs leading-relaxed mt-1">
                      Tingkatkan resolusi & kejelasan gambar hingga 8x tanpa pecah menggunakan engine AI RealESRGAN dari Swiftspeed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Card */}
              <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-4">
                {/* URL Input */}
                <div className="space-y-1.5">
                  <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider block">URL Gambar Target</label>
                  <input
                    type="url"
                    placeholder="https://raw.githubusercontent.com/.../image.jpg"
                    value={upImageUrl}
                    onChange={(e) => { setUpImageUrl(e.target.value); setUpError(null); setUpResult(null); }}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-white/30 text-[10px]">Mendukung ukuran file 150KB hingga 6.5MB.</p>
                </div>

                {/* Scale Selector */}
                <div className="space-y-1.5">
                  <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider block">Scale Factor (Faktor Perbesaran)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 4, 8].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setUpScale(s)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                          upScale === s
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400/40 shadow-md shadow-emerald-500/20"
                            : "border-white/10 text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <i className="fa-solid fa-expand text-[10px]" />
                        <span>{s}x Scale</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleUpscale}
                  disabled={upLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {upLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Memproses Upscale...</span></>
                  ) : (
                    <><i className="fa-solid fa-wand-magic-sparkles" /><span>Tingkatkan Resolusi Gambar ({upScale}x)</span></>
                  )}
                </button>
              </div>

              {/* Progress */}
              {upLoading && upProgress && (
                <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-xs text-emerald-300 font-mono">{upProgress}</span>
                </div>
              )}

              {/* Error */}
              {upError && !upLoading && (
                <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-950/40 text-xs text-rose-200 flex items-start gap-2 animate-slide-up">
                  <i className="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold mb-0.5">❌ Gagal Upscale</p>
                    <p className="text-rose-300/80">{upError}</p>
                  </div>
                </div>
              )}

              {/* Result */}
              {upResult && !upLoading && (
                <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 space-y-3 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-emerald-300 font-bold text-xs flex items-center gap-2">
                      <i className="fa-solid fa-circle-check" />
                      <span>Upscale Berhasil ✅</span>
                    </h4>
                    <span className="text-white/40 text-[10px] font-mono">Engine: {upResult.engine}</span>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                    <img
                      src={upResult.download_url}
                      alt="Upscaled result"
                      className="w-full object-contain max-h-72"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>

                  {(upResult.original_size || upResult.processed_size) && (
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-white/40 block">Ukuran Asli:</span>
                        <span className="text-white font-mono font-bold">{upResult.original_size || "N/A"}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-emerald-400/70 block">Ukuran Hasil ({upScale}x):</span>
                        <span className="text-emerald-300 font-mono font-bold">{upResult.processed_size || "N/A"}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Download URL</p>
                    <a
                      href={upResult.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] font-mono text-emerald-400 hover:text-emerald-300 break-all bg-white/5 rounded-lg px-2 py-1.5 border border-white/10 hover:border-emerald-500/30 transition-colors"
                    >
                      {upResult.download_url}
                    </a>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={upResult.download_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:from-emerald-500 hover:to-teal-500 transition-all active:scale-95 shadow-md shadow-emerald-600/30"
                    >
                      <i className="fa-solid fa-download" />
                      <span>Download Gambar High-Res</span>
                    </a>
                    <button
                      onClick={() => { setUpResult(null); setUpImageUrl(""); }}
                      className="px-4 py-2.5 rounded-xl border border-white/15 text-white/60 hover:text-white hover:bg-white/10 text-xs font-bold transition-all"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTool === "tools_list" && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-xs text-white/60 mb-2">
                Pilih perkakas tambahan yang tersedia di dalam ekosistem Mobile Finance Tracker:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tool Card 0: Shinigami Reader */}
                <div
                  onClick={() => setActiveTool("shinigami")}
                  className="glass-card rounded-2xl p-4 border border-rose-500/30 hover:border-rose-400 cursor-pointer transition-all hover:bg-rose-500/10 space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-lg">
                      <i className="fa-solid fa-book-open" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Aktif & Online
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm group-hover:text-rose-300 transition-colors">
                    Shinigami Manga Reader
                  </h4>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Baca Manhwa, Manga, & Manhua Indonesia via API Shinigami dengan UI Fullscreen Reader interaktif.
                  </p>
                </div>

                {/* Tool Card 0.5: Anichin Donghua Streamer */}
                <div
                  onClick={() => setActiveTool("anichin")}
                  className="glass-card rounded-2xl p-4 border border-cyan-500/30 hover:border-cyan-400 cursor-pointer transition-all hover:bg-cyan-500/10 space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg">
                      <i className="fa-solid fa-play" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Aktif & Online
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm group-hover:text-cyan-300 transition-colors">
                    Anichin Donghua Streamer
                  </h4>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Nonton Donghua (BTTH, Perfect World, Soul Land, DLL) Sub Indo dengan video player & daftar episode.
                  </p>
                </div>

                {/* Tool Card 1: Background Removal */}
                <div
                  onClick={() => setActiveTool("bgremove")}
                  className="glass-card rounded-2xl p-4 border border-sky-500/30 hover:border-sky-400 cursor-pointer transition-all hover:bg-sky-500/10 space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-lg">
                      <i className="fa-solid fa-eraser" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      Aktif & Online
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm group-hover:text-sky-300 transition-colors">
                    AI Background Removal
                  </h4>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Hapus background gambar otomatis via ezremove.ai API dengan 6 mode AI (General, Logo, Anime, dll).
                  </p>
                </div>

                {/* Tool Card 2: Swiftspeed Image Upscaler */}
                <div
                  onClick={() => { setActiveTool("upscale"); setUpResult(null); setUpError(null); }}
                  className="glass-card rounded-2xl p-4 border border-emerald-500/30 hover:border-emerald-400 cursor-pointer transition-all hover:bg-emerald-500/10 space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                      <i className="fa-solid fa-wand-magic-sparkles" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Aktif & Online
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm group-hover:text-emerald-300 transition-colors">
                    AI Image Upscaler
                  </h4>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Tingkatkan resolusi gambar hingga 8x lipat via Swiftspeed RealESRGAN AI (150KB - 6.5MB).
                  </p>
                </div>

                {/* Tool Card 3: QR & Barcode Generator */}
                <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-2 opacity-80">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg">
                      <i className="fa-solid fa-qrcode" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                      Segera Hadir
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm">QR Code & Payment Generator</h4>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Buat kode QR invoice dan nomor transaksi pembayaran secara otomatis.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Inline Markdown Formatting Helper ─────────────────────────────────────────
function renderInlineText(text: string): React.ReactNode {
  if (!text) return "";
  const parts: React.ReactNode[] = [];
  const regex = /(\[.*?\]\(.*?\))|(\*\*.*?\*\*|__.*?__)|(<u>.*?<\/u>)|(\*.*?\*|_.*?_)|(`.*?`)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("[") && token.includes("](")) {
      const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-violet-400 hover:text-violet-300 underline font-semibold transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      }
    } else if (token.startsWith("**") || token.startsWith("__")) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={match.index} className="font-bold text-white drop-shadow-sm">
          {renderInlineText(inner)}
        </strong>
      );
    } else if (token.startsWith("<u>") && token.endsWith("</u>")) {
      const inner = token.slice(3, -4);
      parts.push(
        <u key={match.index} className="underline decoration-violet-400 decoration-2 underline-offset-4 font-semibold text-slate-100">
          {renderInlineText(inner)}
        </u>
      );
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      const inner = token.slice(1, -1);
      parts.push(
        <em key={match.index} className="italic text-slate-300">
          {renderInlineText(inner)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const inner = token.slice(1, -1);
      parts.push(
        <code key={match.index} className="bg-white/10 text-violet-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-white/15">
          {inner}
        </code>
      );
    } else {
      parts.push(token);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}

// ─── Full Formatted Markdown Renderer Component ────────────────────────────────
function FormattedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Blocks (```)
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      elements.push(
        <div key={`code-${i}`} className="my-3 rounded-2xl border border-white/15 bg-[#0a0c1a] overflow-hidden shadow-2xl">
          <div className="bg-white/5 px-4 py-1.5 border-b border-white/10 text-[10px] font-mono text-white/40 uppercase tracking-wider">
            Code Block
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
            {codeLines.join("\n")}
          </pre>
        </div>
      );
      continue;
    }

    // 2. Table (| Col 1 | Col 2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableRows: string[][] = [];

      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const rowLine = lines[i].trim();
        // Skip separator row (|---|---|)
        if (/^\|[\s\-:|]+\|$/.test(rowLine)) {
          i++;
          continue;
        }
        const cells = rowLine
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
        tableRows.push(cells);
        i++;
      }

      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1);

        elements.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-2xl border border-white/15 bg-white/5 shadow-xl">
            <table className="w-full text-left text-xs border-collapse min-w-[280px]">
              <thead className="bg-violet-950/70 text-violet-200 border-b border-white/15 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5 border-r border-white/10 last:border-r-0">
                      {renderInlineText(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-200">
                {bodyRows.map((r, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                    {r.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2.5 border-r border-white/10 last:border-r-0 leading-relaxed">
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Horizontal Rule (---, ***, ___)
    if (/^(\-\-\-|[*]{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="my-4 border-t border-white/15 drop-shadow-sm" />);
      i++;
      continue;
    }

    // 4. Headings (#, ##, ###, ####)
    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^(#{1,4})\s*(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        if (level === 1) {
          elements.push(
            <h1 key={`h1-${i}`} className="text-xl md:text-2xl font-extrabold text-white mt-4 mb-2 tracking-tight border-b border-white/15 pb-1.5">
              {renderInlineText(text)}
            </h1>
          );
        } else if (level === 2) {
          elements.push(
            <h2 key={`h2-${i}`} className="text-lg md:text-xl font-bold text-violet-300 mt-3.5 mb-2">
              {renderInlineText(text)}
            </h2>
          );
        } else if (level === 3) {
          elements.push(
            <h3 key={`h3-${i}`} className="text-base md:text-lg font-bold text-slate-100 mt-3 mb-1.5">
              {renderInlineText(text)}
            </h3>
          );
        } else {
          elements.push(
            <h4 key={`h4-${i}`} className="text-sm font-bold text-slate-200 mt-2.5 mb-1">
              {renderInlineText(text)}
            </h4>
          );
        }
        i++;
        continue;
      }
    }

    // 5. Blockquotes (> text)
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s*/, "");
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-violet-500/80 bg-violet-950/30 pl-4 py-2.5 my-2.5 rounded-r-2xl italic text-slate-300">
          {renderInlineText(quoteText)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 6. Bullet Lists (*, -)
    if (/^[\*\-]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[\*\-]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[\*\-]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1.5 my-2 pl-1 text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineText(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. Numbered Lists (1. , 2. )
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1.5 my-2 pl-1 text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineText(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 8. Regular Empty lines
    if (trimmed === "") {
      elements.push(<div key={`blank-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 9. Standard Paragraphs
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed my-1 text-slate-200">
        {renderInlineText(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1 text-xs md:text-sm">{elements}</div>;
}

interface ChatMessageItem {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageItem[];
  selectedModel?: string;
  pinned?: boolean;
}

const PROMPT_LIBRARY_ITEMS = [
  {
    category: "📊 Audit & Evaluasi",
    title: "Evaluasi Rasio 50/30/20",
    prompt: "Tolong analisis seluruh pengeluaran saya berdasarkan metode 50/30/20 (Needs, Wants, Savings) dan berikan umpan balik.",
    icon: "fa-chart-pie",
  },
  {
    category: "📊 Audit & Evaluasi",
    title: "Audit Transaksi Terakhir",
    prompt: "Bantu saya mengaudit pengeluaran bulan ini dan sebutkan kategori mana yang menyerap anggaran paling besar.",
    icon: "fa-magnifying-glass-chart",
  },
  {
    category: "💡 Penghematan & Tips",
    title: "Pangkas Biaya Konsumsi",
    prompt: "Bagaimana strategi efisien untuk memangkas pengeluaran makan & minum hingga 25% tanpa mengurangi gizi?",
    icon: "fa-utensils",
  },
  {
    category: "💡 Penghematan & Tips",
    title: "Rencana Dana Darurat",
    prompt: "Buatkan kalkulasi dan panduan realistis untuk membangun dana darurat sebesar 6 bulan pengeluaran.",
    icon: "fa-shield-heart",
  },
  {
    category: "📈 Investasi & Tabungan",
    title: "Alokasi Portofolio Berisiko Rendah",
    prompt: "Berapa nominal atau persentase dari sisa saldo saya yang aman ditempatkan pada tabungan/reksadana berisiko rendah?",
    icon: "fa-piggy-bank",
  },
  {
    category: "🧾 Agenda & Tagihan",
    title: "Pemeriksaan Tagihan Rutin",
    prompt: "Tinjau agenda tagihan rutin saya untuk bulan ini dan rekomendasikan urutan pembayaran berdasarkan prioritas.",
    icon: "fa-file-invoice-dollar",
  },
];

const AI_GEMS_PERSONAS = [
  {
    id: "general",
    title: "NexAI Finance Pro",
    desc: "Asisten Keuangan Serbaguna & Analis Data Finansial Utama",
    icon: "fa-wand-magic-sparkles",
    color: "bg-white/10 text-white border border-white/15",
    badge: "Utama",
    promptIntro: "Mode Aktif: NexAI Finance Pro. Siap membantu analisis & pertanyaan keuangan Anda.",
  },
  {
    id: "frugal",
    title: "Frugal Master",
    desc: "Pakar Hemat Ekstrem & Pemburu Diskon/Penghematan",
    icon: "fa-shield-halved",
    color: "bg-white/10 text-white border border-white/15",
    badge: "Hemat",
    promptIntro: "Mode Aktif: Frugal Master. Mari kita temukan cara terbaik memangkas biaya tidak perlu!",
  },
  {
    id: "investor",
    title: "Wealth Planner",
    desc: "Konsultan Pertumbuhan Portofolio & Pertumbuhan Aset",
    icon: "fa-chart-line",
    color: "bg-white/10 text-white border border-white/15",
    badge: "Investasi",
    promptIntro: "Mode Aktif: Wealth Planner. Fokus pada pengembangan tabungan & akumulasi kekayaan.",
  },
  {
    id: "debt",
    title: "Debt Buster",
    desc: "Strategi Pelunasan Tagihan & Eliminasi Cicilan",
    icon: "fa-scale-balanced",
    color: "bg-white/10 text-white border border-white/15",
    badge: "Tagihan",
    promptIntro: "Mode Aktif: Debt Buster. Mari buat urutan pelunasan tagihan terstruktur.",
  },
];

function groupChatSessions(sessions: ChatSession[]) {
  const pinned: ChatSession[] = [];
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const thisWeek: ChatSession[] = [];
  const older: ChatSession[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  sessions.forEach(sess => {
    if (sess.pinned) {
      pinned.push(sess);
      return;
    }
    const sessTime = new Date(sess.updatedAt || sess.createdAt).getTime();
    if (sessTime >= todayStart) {
      today.push(sess);
    } else if (sessTime >= yesterdayStart) {
      yesterday.push(sess);
    } else if (sessTime >= weekStart) {
      thisWeek.push(sess);
    } else {
      older.push(sess);
    }
  });

  return { pinned, today, yesterday, thisWeek, older };
}

// ─── AI Agent Tab Component (Gemini Style UI) ───────────────────────────────
function AiTab({
  transactions,
  budget,
  events,
  currentUser,
  currency,
  language = "id",
  darkMode = true,
  onShowToast,
}: {
  transactions: Transaction[];
  budget: BudgetItem[];
  events: ScheduleEvent[];
  currentUser: User | null;
  currency: Currency;
  language?: Lang;
  darkMode?: boolean;
  onShowToast: (msg: string, type: "success" | "info" | "alert") => void;
}) {
  const [subTab, setSubTab] = useState<"chat" | "summary">("chat");
  const [availableModels, setAvailableModels] = useState(OPENROUTER_MODELS);
  
  // Model Persistence
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem("openrouter_selected_model") || "dots-studio/dots-3-note-preview:free";
  });

  useEffect(() => {
    localStorage.setItem("openrouter_selected_model", selectedModel);
  }, [selectedModel]);

  const [modelSearch, setModelSearch] = useState("");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openrouter_api_key") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showGemsModal, setShowGemsModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [activeGem, setActiveGem] = useState(AI_GEMS_PERSONAS[0]);

  // Chat History & Session Persistence State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem("openrouter_chat_sessions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState("");
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);

  // Save sessions to localStorage whenever chatSessions changes
  useEffect(() => {
    try {
      localStorage.setItem("openrouter_chat_sessions", JSON.stringify(chatSessions));
    } catch (e) {
      console.error("Failed to save chat sessions", e);
    }
  }, [chatSessions]);

  const handleCreateNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowSidebar(false);
    onShowToast("Obrolan baru dimulai", "info");
  };

  const handleSelectSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    if (session.selectedModel) {
      setSelectedModel(session.selectedModel);
    }
    setShowSidebar(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    setChatSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
    onShowToast("Riwayat chat dihapus", "info");
  };

  const handleSaveRename = (sessionId: string) => {
    if (!renameTitleInput.trim()) return;
    setChatSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, title: renameTitleInput.trim() } : s))
    );
    setEditingSessionId(null);
    onShowToast("Nama chat diperbarui", "success");
  };

  const handleTogglePin = (sessionId: string) => {
    setChatSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, pinned: !s.pinned } : s))
    );
    onShowToast("Status sematan disesuaikan", "info");
  };

  const handleClearAllHistory = () => {
    setChatSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    setShowClearConfirmModal(false);
    setShowSidebar(false);
    onShowToast("Seluruh riwayat chat dihapus", "info");
  };

  const filteredSessions = chatSessions.filter(s =>
    s.title.toLowerCase().includes(historySearchQuery.toLowerCase())
  );

  // Dynamically fetch all free models from OpenRouter API
  useEffect(() => {
    fetch("https://openrouter.ai/api/v1/models")
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          const liveFreeModels = data.data
            .filter((m: any) => (m.id.endsWith(":free") || m.pricing?.prompt === "0") && m.id !== "google/gemini-2.5-flash:free")
            .map((m: any) => {
              const nameClean = (m.name || m.id).replace(/\(free\)/gi, "").trim();
              const parts = nameClean.split(":");
              const displayName = parts[parts.length - 1].trim();
              const words = displayName.split(" ");
              return {
                value: m.id,
                label: `${displayName} (Gratis)`,
                provider: m.id.split("/")[0] || "OpenRouter",
                titleBold: words[0] || "AI",
                titleMuted: words.slice(1).join(" ") || "Free",
              };
            });

          if (liveFreeModels.length > 0) {
            setAvailableModels(prev => {
              const existingIds = new Set(prev.map(item => item.value));
              const newItems = liveFreeModels.filter((item: any) => !existingIds.has(item.value));
              return [...prev, ...newItems];
            });
          }
        }
      })
      .catch(() => null);
  }, []);

  // Summary State
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryReport, setSummaryReport] = useState<string | null>(null);
  const [summaryProvider, setSummaryProvider] = useState<string>("local_engine");

  // Chat State
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Compute Live Quick Metrics
  const totalIncome = useMemo(() => transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [transactions]);
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((balance / totalIncome) * 100)) : 0;

  // Auto Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Generate Financial Summary & User Management Analysis
  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      if (apiKey && apiKey.trim()) {
        const systemPrompt = `Anda adalah seorang konsultan keuangan profesional dan analis manajemen akun pengguna.
Data Keuangan Pengguna (${currentUser?.fullName || "Pengguna"}):
- Total Pemasukan: ${formatCurrency(totalIncome, currency)}
- Total Pengeluaran: ${formatCurrency(totalExpense, currency)}
- Saldo Bersih: ${formatCurrency(balance, currency)}
- Rasio Hemat: ${savingsRate}%
- Total Transaksi: ${transactions.length}
- Jumlah Anggaran Ditentukan: ${budget.length}
- Jumlah Agenda: ${events.length}

Buatlah laporan analisis ringkas dalam format Markdown Bahasa Indonesia yang mencakup:
1. 📊 Rangkuman Data Keuangan (Financial Summary)
2. 💡 Umpan Balik & Analisis Pengeluaran (Financial Feedback)
3. 👤 Analisis Perilaku & Manajemen Pengguna (User Management Analysis)
4. 🎯 Rekomendasi Aksi Hemat`;

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
            "HTTP-Referer": window.location.href,
            "X-Title": "Mobile Finance Tracker App",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: "user", content: systemPrompt }],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          const replyText = data.choices?.[0]?.message?.content;
          if (replyText) {
            setSummaryReport(replyText);
            setSummaryProvider(`openrouter (${selectedModel})`);
            onShowToast("Analisis AI berhasil diperbarui dari OpenRouter!", "success");
            setSummaryLoading(false);
            return;
          }
        }
      }

      // Local calculation fallback if API call fails or no API Key
      const fallbackText = `### 📊 Rangkuman Data Keuangan (Financial Summary)
- **Total Pemasukan:** ${formatCurrency(totalIncome, currency)}
- **Total Pengeluaran:** ${formatCurrency(totalExpense, currency)}
- **Saldo Bersih:** ${formatCurrency(balance, currency)}
- **Rasio Hemat:** ${savingsRate}% dari pemasukan
- **Total Transaksi:** ${transactions.length} transaksi tercatat.

---

### 💡 Umpan Balik & Analisis Pengeluaran (Financial Feedback)
${savingsRate >= 20 
  ? "🟢 **Kondisi Keuangan Sangat Sehat!** Anda berhasil menyisihkan lebih dari 20% pemasukan. Pertahankan disiplin ini."
  : savingsRate > 0 
  ? "🟡 **Kondisi Keuangan Stabil.** Rasio hemat Anda di bawah 20%. Cobalah memangkas pengeluaran non-primer."
  : "🔴 **Perhatian Cashflow!** Pengeluaran Anda melebihi pemasukan. Segera tinjau kategori pengeluaran terbesar."}

---

### 👤 Analisis Perilaku & Manajemen Pengguna (User Management Analysis)
- **Status Akun:** Aktif (${currentUser?.fullName || "Pengguna"})
- **Aktivitas Pencatatan:** ${transactions.length >= 5 ? "Sangat Disiplin (Aktif mencatat transaksi)" : "Perlu ditingkatkan (Kurang dari 5 transaksi)"}.
- **Manajemen Anggaran:** Mengatur **${budget.length} batas anggaran** dan **${events.length} agenda**.

---

### 🎯 Rekomendasi Aksi Hemat
1. Alokasikan 10-20% gaji awal bulan ke tabungan terpisah.
2. Batasi pengeluaran kategori tersier.
3. Catat setiap transaksi harian secara konsisten.`;
      setSummaryReport(fallbackText);
      setSummaryProvider("local_engine");
      if (!apiKey) {
        onShowToast("Analisis lokal dimuat. Masukkan API Key untuk AI OpenRouter.", "info");
      }
    } catch {
      onShowToast("Gagal memuat analisis AI", "alert");
    } finally {
      setSummaryLoading(false);
    }
  };

  // Initial Summary load if null
  useEffect(() => {
    if (!summaryReport) {
      handleGenerateSummary();
    }
  }, []);

  // Send AI Chat message (Strict OpenRouter Enforcement)
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMsg;
    if (!textToSend.trim()) return;

    // Strict Check: Require OpenRouter API Key before sending
    if (!apiKey || !apiKey.trim()) {
      setTempKey("");
      setShowKeyModal(true);
      onShowToast("Silakan masukkan OpenRouter API Key terlebih dahulu untuk menggunakan AI Chat.", "error");
      return;
    }

    // Ensure active session ID exists immediately before sending
    let currentSessId = activeSessionId;
    let isNewSession = false;

    if (!currentSessId) {
      currentSessId = `session_${Date.now()}`;
      setActiveSessionId(currentSessId);
      isNewSession = true;
    }

    const userMsg: ChatMessageItem = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessagesWithUser = [...messages, userMsg];
    setMessages(newMessagesWithUser);
    if (!customText) setInputMsg("");
    setShowQuickMenu(false);
    setIsTyping(true);

    // Immediately create/update session in chatSessions list
    const nowIso = new Date().toISOString();
    const sessionTitle = textToSend.trim().slice(0, 32) + (textToSend.trim().length > 32 ? "..." : "");

    setChatSessions(prevSessions => {
      const existing = prevSessions.find(s => s.id === currentSessId);
      if (existing) {
        return prevSessions.map(s =>
          s.id === currentSessId
            ? { ...s, updatedAt: nowIso, messages: newMessagesWithUser, selectedModel }
            : s
        );
      } else {
        const newSess: ChatSession = {
          id: currentSessId!,
          title: sessionTitle,
          createdAt: nowIso,
          updatedAt: nowIso,
          messages: newMessagesWithUser,
          selectedModel,
        };
        return [newSess, ...prevSessions];
      }
    });

    try {
      const currentDateStr = new Date().toLocaleString("id-ID", {
        dateStyle: "full",
        timeStyle: "medium",
      });

      const systemPrompt = `Anda adalah asisten AI serbaguna, cerdas, dan serba bisa (${activeGem.title}). Mode spesialisasi Anda: ${activeGem.desc}.
Anda dapat menjawab berbagai pertanyaan tentang topik apa pun (seperti pendidikan, sains, teknologi, budaya, kehidupan sehari-hari, waktu/jam, umum, dsb.) secara bebas, akurat, dan ramah.

Informasi Konteks Sistem & Pengguna:
- Tanggal & Waktu Saat Ini: ${currentDateStr}
- Nama Pengguna: ${currentUser?.fullName || "Pengguna"}
- Saldo Keuangan: ${formatCurrency(balance, currency)} (Pemasukan: ${formatCurrency(totalIncome, currency)}, Pengeluaran: ${formatCurrency(totalExpense, currency)})

Petunjuk Jawaban:
1. Jawablah secara lengkap, akurat, dan ramah sesuai spesialisasi persona Anda (${activeGem.title}).
2. Jika pengguna bertanya khusus mengenai keuangan, gunakan data di atas untuk memberikan umpan balik finansial yang relevan.
3. Gunakan Bahasa Indonesia yang ramah, santun, dan format markdown (bold, list, code block) yang rapi.`;

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.slice(-6).map(m => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        })),
        { role: "user", content: textToSend.trim() },
      ];

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "HTTP-Referer": window.location.href,
          "X-Title": "Mobile Finance Tracker App",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.choices?.[0]?.message?.content || "Maaf, tidak ada respons dari model OpenRouter.";
        const aiMsg: ChatMessageItem = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages(prev => {
          const updatedWithAi = [...prev, aiMsg];
          setChatSessions(prevSessions =>
            prevSessions.map(s =>
              s.id === currentSessId
                ? { ...s, updatedAt: new Date().toISOString(), messages: updatedWithAi, selectedModel }
                : s
            )
          );
          return updatedWithAi;
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errDetail = errorData?.error?.message || `HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403) {
          setTempKey(apiKey);
          setShowKeyModal(true);
          onShowToast("OpenRouter API Key tidak valid. Silakan periksa kembali.", "error");
        } else {
          onShowToast(`Gagal dari OpenRouter: ${errDetail}`, "error");
        }
      }
    } catch (err: any) {
      onShowToast("Gagal terhubung ke OpenRouter API", "error");
    } finally {
      setIsTyping(false);
    }
  };

  const saveApiKey = () => {
    localStorage.setItem("openrouter_api_key", tempKey.trim());
    setApiKey(tempKey.trim());
    setShowKeyModal(false);
    onShowToast("OpenRouter API Key disimpan!", "success");
  };

  const handleVoiceListen = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      onShowToast("Fitur input suara tidak didukung oleh peramban ini", "alert");
      return;
    }
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.interimResults = false;

      setIsVoiceListening(true);
      onShowToast("Silakan bicara sekarang...", "info");

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMsg(transcript);
        setIsVoiceListening(false);
        onShowToast(`Suara terdeteksi: "${transcript}"`, "success");
      };

      recognition.onerror = () => {
        setIsVoiceListening(false);
        onShowToast("Gagal merekam suara, silakan ketik manual", "alert");
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognition.start();
    } catch {
      setIsVoiceListening(false);
      onShowToast("Tidak dapat memulai mikrofon", "alert");
    }
  };

  const selectedModelObj = availableModels.find(m => m.value === selectedModel) || availableModels[0];

  const filteredModels = availableModels.filter(m =>
    m.label.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.titleBold.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.provider.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#050714] dark:bg-[#050714] text-slate-900 dark:text-slate-100 relative overflow-hidden font-sans ai-chat-container">
      {/* ── Top Floating Positioned Components (Exact Gemini Style) ── */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between z-20 bg-transparent">
        <div className="flex items-center gap-3">
          {/* Minimal 2-Line Hamburger Menu Icon (Opens Chat History Sidebar) */}
          <button
            onClick={() => setShowSidebar(true)}
            className="p-1 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Chat History Menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
            </svg>
          </button>

          {/* Dynamic Model Dropdown Selector (Title updates dynamically) */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-medium text-base transition-colors py-1 px-1"
            >
              <span className="font-semibold text-slate-900 dark:text-white">{selectedModelObj.titleBold}</span>
              <span className="text-slate-500 dark:text-white/40 text-sm font-light">{selectedModelObj.titleMuted}</span>
              <svg className="w-3.5 h-3.5 text-slate-400 dark:text-white/40 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Model Picker Popup Dropdown */}
            {showModelPicker && (
              <div className="absolute top-9 left-0 w-80 ai-model-picker rounded-2xl p-2.5 shadow-2xl z-50 backdrop-blur-2xl animate-fade-in space-y-2 max-h-96 flex flex-col">
                <div className="flex items-center justify-between px-2 pt-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Model Free OpenRouter ({availableModels.length})
                  </p>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">100% GRATIS</span>
                </div>

                {/* Model Search Bar */}
                <input
                  type="text"
                  placeholder="Cari model free..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="w-full text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />

                {/* Scrollable Free Model List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-64 no-scrollbar">
                  {filteredModels.map(m => (
                    <button
                      key={m.value}
                      onClick={() => {
                        setSelectedModel(m.value);
                        setShowModelPicker(false);
                        onShowToast(`Model diubah ke ${m.titleBold} ${m.titleMuted}`, "info");
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        selectedModel === m.value
                          ? "bg-violet-600/30 text-violet-300 font-bold"
                          : "hover:bg-white/10"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="font-semibold text-slate-100 truncate">
                          {m.titleBold} <span className="font-normal model-muted">{m.titleMuted}</span>
                        </p>
                        <p className="text-[10px] model-label truncate">{m.label}</p>
                      </div>
                      {selectedModel === m.value && <span className="text-violet-400 font-bold flex-shrink-0">✓</span>}
                    </button>
                  ))}
                  {filteredModels.length === 0 && (
                    <p className="text-center text-xs model-muted py-4">Model free tidak ditemukan</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Header Right Actions (Frameless) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab(subTab === "chat" ? "summary" : "chat")}
            className={`text-xs font-semibold transition-all flex items-center gap-1.5 py-1 px-2.5 rounded-lg ${
              subTab === "summary"
                ? "bg-violet-600/40 text-violet-200"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            {subTab === "chat" ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Laporan</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Chat</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowKeyModal(true)}
            className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-white/5 rounded-lg transition-all"
            title="OpenRouter API Key Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── SUB-TAB 1: Gemini Chat Interface (User Screenshot Style) ── */}
      {subTab === "chat" && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
          {/* Messages Container or Center Hero State */}
          {messages.length === 0 ? (
            /* Gemini Hero Welcome Center State (Matching Screenshot) */
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center animate-fade-in my-auto space-y-6">
              {/* Four-pointed Glowing Gemini Spark Icon */}
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 rounded-full blur-2xl opacity-40 group-hover:opacity-75 transition-opacity animate-pulse" />
                <GeminiSparkIcon className="w-14 h-14 relative drop-shadow-[0_0_25px_rgba(129,140,248,0.8)]" />
              </div>

              {/* Central Question Heading */}
              <div className="space-y-2 max-w-md">
                <h2 className="text-3xl md:text-4xl font-light text-slate-900 dark:text-white tracking-tight">
                  What should we focus on?
                </h2>
              </div>
            </div>
          ) : (
            /* Conversation Messages Stream */
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 tab-scroll">
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                return (
                  <div key={msg.id} className={`flex gap-3 max-w-3xl mx-auto ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md">
                        <GeminiSparkIcon className="w-5 h-5" />
                      </div>
                    )}

                    <div
                      className={`rounded-3xl p-4 text-xs md:text-sm leading-relaxed max-w-[85%] ${
                        isUser
                          ? "bg-violet-600 text-white rounded-tr-sm shadow-md"
                          : "bg-white dark:bg-transparent text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-none shadow-sm dark:shadow-none"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <FormattedMarkdown content={msg.text} />
                      )}
                      <span className={`text-[9px] block mt-2 text-right font-mono ${isUser ? "text-white/70" : "text-slate-400 dark:text-white/30"}`}>
                        {msg.timestamp}
                      </span>
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0 shadow-md">
                        👤
                      </div>
                    )}
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex gap-3 max-w-3xl mx-auto justify-start items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md animate-spin">
                    <GeminiSparkIcon className="w-5 h-5" />
                  </div>
                  <div className="text-xs text-violet-600 dark:text-violet-300 font-light flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                    <span>{selectedModelObj.titleBold} {selectedModelObj.titleMuted} is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {/* ── Signature Floating Capsule Bar ── */}
          <div className="p-4 z-20 pb-28 md:pb-32 mb-2">
            {/* Quick Menu Popover */}
            {showQuickMenu && (
              <div className="max-w-xl mx-auto mb-3 bg-white dark:bg-[#1c1d24] border border-slate-200 dark:border-white/10 rounded-2xl p-3 shadow-2xl animate-fade-in flex gap-2 overflow-x-auto no-scrollbar">
                {[
                  "📊 Sisa Anggaran",
                  "💡 Tips 20% Gaji",
                  "👤 Disiplin User",
                  "🚀 Alokasi 50/30/20",
                  "🗑️ Clear Chat",
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (item.includes("Clear")) {
                        setMessages([]);
                        setShowQuickMenu(false);
                        onShowToast("Chat dibersihkan", "info");
                      } else {
                        handleSendMessage(item);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/15 text-xs text-violet-700 dark:text-violet-300 font-medium whitespace-nowrap"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            {/* Solid Pill Capsule Bar */}
            <div className="max-w-xl mx-auto flex items-center gap-3 rounded-full bg-white dark:bg-[#1c1d24] border border-slate-200/90 dark:border-white/10 px-5 py-3.5 shadow-2xl transition-all">
              {/* Plus Icon */}
              <button
                onClick={() => setShowQuickMenu(!showQuickMenu)}
                className="text-slate-500 dark:text-white/70 hover:text-slate-800 dark:hover:text-white transition-colors text-2xl font-light leading-none flex items-center justify-center"
                title="Tambahkan atau pilih prompt cepat"
              >
                +
              </button>

              {/* Main Input Field */}
              <input
                type="text"
                placeholder={language === "EN" ? "Ask NexAI" : "Tanyakan NexAI"}
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                className="flex-1 bg-transparent text-sm md:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none px-1"
              />

              {/* Voice Input Mic Button */}
              <button
                onClick={handleVoiceListen}
                className={`p-1 transition-all ${
                  isVoiceListening ? "text-rose-500 animate-bounce" : "text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                }`}
                title={isVoiceListening ? "Merekam suara..." : "Input Suara (Speech to Text)"}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {/* Submit Send Button if input is typed */}
              {inputMsg.trim().length > 0 && (
                <button
                  onClick={() => handleSendMessage()}
                  className="w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: Financial Analytics & User Management Summary ── */}
      {subTab === "summary" && (
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 tab-scroll">
          {/* Quick AI Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="glass-card rounded-2xl p-3 text-center border border-emerald-500/30">
              <p className="text-[10px] text-white/40 uppercase font-bold">Rasio Hemat</p>
              <p className="font-extrabold text-base text-emerald-400 font-mono mt-0.5">{savingsRate}%</p>
              <p className="text-[10px] text-white/50">{savingsRate >= 20 ? "Ideal" : "Di bawah 20%"}</p>
            </div>

            <div className="glass-card rounded-2xl p-3 text-center border border-violet-500/30">
              <p className="text-[10px] text-white/40 uppercase font-bold">Saldo Keuangan</p>
              <p className="font-extrabold text-xs text-violet-300 font-mono mt-1 truncate">{formatShortCurrency(balance, currency)}</p>
              <p className="text-[10px] text-white/50">{transactions.length} Transaksi</p>
            </div>

            <div className="glass-card rounded-2xl p-3 text-center border border-cyan-500/30">
              <p className="text-[10px] text-white/40 uppercase font-bold">Skor Disiplin</p>
              <p className="font-extrabold text-base text-cyan-300 font-mono mt-0.5">
                {transactions.length >= 8 ? "95%" : transactions.length >= 3 ? "75%" : "40%"}
              </p>
              <p className="text-[10px] text-white/50">User Activity</p>
            </div>
          </div>

          {/* Refresh Analysis Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-white/60 text-xs font-semibold">Engine: {summaryProvider === "openrouter" ? "OpenRouter Cloud AI" : "Smart Local Engine"}</span>
            </div>

            <button
              onClick={handleGenerateSummary}
              disabled={summaryLoading}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 ${summaryLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{summaryLoading ? "Menganalisis..." : "Regenerasi Analisis AI"}</span>
            </button>
          </div>

          {/* AI Report Card Content */}
          <div className="glass-card rounded-3xl p-5 border border-white/15 space-y-3 leading-relaxed text-xs text-slate-200">
            {summaryLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-violet-300 font-semibold text-xs">OpenRouter Agent sedang memproses & menganalisis seluruh data Anda...</p>
              </div>
            ) : summaryReport ? (
              <div className="prose prose-invert max-w-none text-xs space-y-3">
                <FormattedMarkdown content={summaryReport} />
              </div>
            ) : (
              <p className="text-white/40 text-center py-6">Klik tombol regenerasi di atas untuk membuat analisis AI.</p>
            )}

            {/* Quick Action to Chatbot */}
            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(summaryReport || "");
                  onShowToast("Laporan AI disalin ke clipboard!", "success");
                }}
                className="px-3 py-1.5 rounded-xl glass text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Salin Laporan</span>
              </button>
              <button
                onClick={() => {
                  setSubTab("chat");
                  handleSendMessage("Berikan rekomendasi konkret untuk mengoptimalkan keuanganku bulan ini.");
                }}
                className="px-3 py-1.5 rounded-xl bg-violet-600/30 border border-violet-500/40 text-violet-200 text-[11px] font-bold hover:bg-violet-600/50 transition-all flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Konsultasikan di Chatbot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat History Sidebar Drawer (Portal matching Gemini UI) ── */}
      {showSidebar &&
        createPortal(
          <div className={`fixed inset-0 z-[99999] flex font-sans ${darkMode ? "dark" : "light-mode"}`}>
            {/* Minimal Dark Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
              onClick={() => setShowSidebar(false)}
            />

            {/* Sidebar Content Panel */}
            <div className={`relative z-[99999] w-72 max-w-[85vw] h-full flex flex-col shadow-2xl animate-slide-right font-sans transition-colors duration-300 ${
              darkMode 
                ? "bg-[#0d0f17] text-slate-100 border-r border-white/5" 
                : "bg-[#f1f5f9] text-slate-800 border-r border-slate-300 light-mode"
            }`}>
              {/* Drawer Header */}
              <div className="p-3.5 flex items-center justify-between border-b border-slate-300/80 dark:border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-white/10 flex items-center justify-center">
                    <i className="fa-solid fa-gem text-violet-600 dark:text-white text-xs" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight block">NexAI</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="w-7 h-7 flex items-center justify-center text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors hover:bg-slate-200/60 dark:hover:bg-white/10"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              {/* Action: New Chat Button */}
              <div className="p-3">
                <button
                  onClick={handleCreateNewChat}
                  className="w-full bg-slate-200/90 dark:bg-white/10 hover:bg-slate-300/90 dark:hover:bg-white/15 text-slate-800 dark:text-white font-medium text-xs py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-300 dark:border-none shadow-sm"
                >
                  <i className="fa-solid fa-pen-to-square text-violet-600 dark:text-white/70 text-xs" />
                  <span>Obrolan Baru (New Chat)</span>
                </button>
              </div>

              {/* Search Chats Input */}
              <div className="px-3 pb-2">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass text-slate-400 dark:text-white/30 absolute left-3 top-2.5 text-xs" />
                  <input
                    type="text"
                    placeholder="Cari obrolan..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full bg-slate-200/70 dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 border border-slate-300 dark:border-none rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:bg-slate-200 dark:focus:bg-white/10 transition-colors"
                  />
                </div>
              </div>

              {/* Feature Shortcuts */}
              <div className="px-3 py-1 flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowSidebar(false);
                    setShowLibraryModal(true);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-transparent hover:bg-slate-300/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-colors border border-slate-300/60 dark:border-none"
                >
                  <i className="fa-solid fa-book-bookmark text-violet-600 dark:text-slate-400 text-xs" />
                  <span>Library</span>
                </button>
                <button
                  onClick={() => {
                    setShowSidebar(false);
                    setShowGemsModal(true);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-transparent hover:bg-slate-300/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-colors border border-slate-300/60 dark:border-none"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-amber-600 dark:text-slate-400 text-xs" />
                  <span>Gems Persona</span>
                </button>
              </div>

              {/* Recents Chat Sessions Grouped */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 tab-scroll">
                {(() => {
                  const grouped = groupChatSessions(filteredSessions);
                  const groups = [
                    { key: "pinned", label: "Disematkan", items: grouped.pinned, icon: "fa-thumbtack" },
                    { key: "today", label: "Hari Ini", items: grouped.today, icon: "fa-calendar-day" },
                    { key: "yesterday", label: "Kemarin", items: grouped.yesterday, icon: "fa-clock-rotate-left" },
                    { key: "thisWeek", label: "7 Hari Terakhir", items: grouped.thisWeek, icon: "fa-calendar-week" },
                    { key: "older", label: "Lebih Lama", items: grouped.older, icon: "fa-box-archive" },
                  ];

                  const hasAny = filteredSessions.length > 0;
                  if (!hasAny) {
                    return (
                      <div className="text-center py-10 space-y-2">
                        <i className="fa-solid fa-comments text-slate-400 dark:text-white/10 text-2xl block" />
                        <p className="text-xs text-slate-500 dark:text-white/30 italic">Belum ada riwayat chat</p>
                      </div>
                    );
                  }

                  return groups.map(grp => {
                    if (grp.items.length === 0) return null;
                    return (
                      <div key={grp.key} className="space-y-0.5">
                        <div className="px-2 py-1 flex items-center justify-between">
                          <span className="text-[10px] font-medium text-slate-500 dark:text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                            <i className={`fa-solid ${grp.icon} text-[9px]`} />
                            {grp.label}
                          </span>
                        </div>

                        {grp.items.map(session => {
                          const isActive = activeSessionId === session.id;
                          const isEditing = editingSessionId === session.id;

                          return (
                            <div
                              key={session.id}
                              className={`group relative flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                                isActive
                                  ? "bg-slate-300/90 dark:bg-white/10 text-slate-900 dark:text-white font-semibold shadow-sm border border-slate-400/40 dark:border-none"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                              }`}
                              onClick={() => handleSelectSession(session)}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={renameTitleInput}
                                    onChange={(e) => setRenameTitleInput(e.target.value)}
                                    className="bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white text-xs px-2 py-1 rounded w-full focus:outline-none border border-slate-300 dark:border-none"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveRename(session.id)}
                                    className="text-emerald-600 dark:text-emerald-400 font-bold px-1 py-0.5 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs"
                                  >
                                    <i className="fa-solid fa-check" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSessionId(null)}
                                    className="text-rose-600 dark:text-rose-400 font-bold px-1 py-0.5 hover:text-rose-700 dark:hover:text-rose-300 text-xs"
                                  >
                                    <i className="fa-solid fa-xmark" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    <i className={`${session.pinned ? "fa-solid fa-thumbtack text-violet-600 dark:text-slate-300" : "fa-regular fa-message text-slate-400 dark:text-white/20 group-hover:text-slate-600 dark:group-hover:text-white/40"} text-xs`} />
                                    <span className="truncate text-xs">{session.title}</span>
                                  </div>

                                  {/* 3-Dots Action Dropdown Menu */}
                                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        setOpenMenuSessionId(openMenuSessionId === session.id ? null : session.id);
                                      }}
                                      className="p-1 text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white rounded transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <i className="fa-solid fa-ellipsis-vertical text-xs" />
                                    </button>

                                    {openMenuSessionId === session.id && (
                                      <div className="absolute right-0 top-6 w-36 bg-white dark:bg-[#161824] border border-slate-300 dark:border-white/10 rounded-xl shadow-xl z-50 p-1 space-y-0.5 animate-fade-in">
                                        <button
                                          onClick={() => {
                                            handleTogglePin(session.id);
                                            setOpenMenuSessionId(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white flex items-center gap-2"
                                        >
                                          <i className={`fa-solid fa-thumbtack ${session.pinned ? "text-violet-600 dark:text-slate-200" : "text-slate-400"}`} />
                                          <span>{session.pinned ? "Lepas Sematan" : "Sematkan"}</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingSessionId(session.id);
                                            setRenameTitleInput(session.title);
                                            setOpenMenuSessionId(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white flex items-center gap-2"
                                        >
                                          <i className="fa-solid fa-pen text-slate-400" />
                                          <span>Ubah Nama</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleDeleteSession(session.id);
                                            setOpenMenuSessionId(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:text-rose-700 dark:hover:text-rose-200 flex items-center gap-2"
                                        >
                                          <i className="fa-solid fa-trash-can text-rose-500 dark:text-rose-400" />
                                          <span>Hapus</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Clear History Button in Drawer */}
              {chatSessions.length > 0 && (
                <div className="px-3 py-1">
                  <button
                    onClick={() => setShowClearConfirmModal(true)}
                    className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-white/40 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-colors"
                  >
                    <i className="fa-solid fa-trash-can text-xs" />
                    <span>Hapus Seluruh Riwayat</span>
                  </button>
                </div>
              )}

              {/* Drawer Footer Profile & Settings */}
              <div className="p-3 border-t border-slate-300/80 dark:border-white/5 flex items-center justify-between bg-slate-200/40 dark:bg-transparent">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-7 h-7 rounded-full bg-violet-200 dark:bg-white/10 flex items-center justify-center text-xs font-semibold text-violet-800 dark:text-white flex-shrink-0">
                    {currentUser?.fullName?.charAt(0) || "M"}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{currentUser?.fullName || "M.Ikhsan C.P"}</p>
                    <p className="text-[10px] text-slate-500 dark:text-white/40 font-mono">Pro Account</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowSidebar(false);
                    setTempKey(apiKey);
                    setShowKeyModal(true);
                  }}
                  className="p-1.5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors flex-shrink-0"
                  title="OpenRouter API Key Settings"
                >
                  <i className="fa-solid fa-key text-xs" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Prompt Library Modal (Portal) ── */}
      {showLibraryModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-lg bg-[#0d0e1a] glass-card rounded-3xl p-5 border border-white/15 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-book-bookmark text-slate-300 text-base" />
                  <div>
                    <h3 className="text-white font-bold text-base">Library Prompt Keuangan</h3>
                    <p className="text-[10px] text-white/50">Pilih template analisis cepat untuk NexAI</p>
                  </div>
                </div>
                <button onClick={() => setShowLibraryModal(false)} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-full">
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 tab-scroll pr-1">
                {PROMPT_LIBRARY_ITEMS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setShowLibraryModal(false);
                      setSubTab("chat");
                      handleSendMessage(item.prompt);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{item.category}</span>
                      <i className={`fa-solid ${item.icon} text-slate-400 text-xs group-hover:scale-110 transition-transform`} />
                    </div>
                    <h4 className="text-xs font-bold text-white group-hover:text-slate-100">{item.title}</h4>
                    <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">{item.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Gems Persona Selector Modal (Portal) ── */}
      {showGemsModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-md bg-[#0d0e1a] glass-card rounded-3xl p-5 border border-white/15 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles text-slate-300 text-base" />
                  <div>
                    <h3 className="text-white font-bold text-base">Gems AI Persona</h3>
                    <p className="text-[10px] text-white/50">Pilih karakter & spesialisasi asisten AI Anda</p>
                  </div>
                </div>
                <button onClick={() => setShowGemsModal(false)} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-full">
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              <div className="space-y-2.5">
                {AI_GEMS_PERSONAS.map((gem) => {
                  const isSelected = activeGem.id === gem.id;
                  return (
                    <button
                      key={gem.id}
                      onClick={() => {
                        setActiveGem(gem);
                        setShowGemsModal(false);
                        onShowToast(`Mode AI diubah ke: ${gem.title}`, "success");
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-white/15 border-white/30 text-white shadow-md"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${gem.color} flex items-center justify-center text-white shadow-sm`}>
                          <i className={`fa-solid ${gem.icon} text-sm`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">{gem.title}</h4>
                            <span className="text-[9px] bg-white/10 text-white/70 px-1.5 py-0.2 rounded-full font-mono">{gem.badge}</span>
                          </div>
                          <p className="text-[11px] text-white/60 mt-0.5">{gem.desc}</p>
                        </div>
                      </div>
                      {isSelected && <i className="fa-solid fa-circle-check text-white text-base" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Clear History Confirmation Modal (Portal) ── */}
      {showClearConfirmModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-xs bg-[#0d0e1a] glass-card rounded-3xl p-5 border border-white/15 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-slate-200 mx-auto">
                <i className="fa-solid fa-triangle-exclamation text-xl text-rose-300" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Hapus Seluruh Riwayat Chat?</h3>
                <p className="text-[11px] text-white/60 mt-1">Tindakan ini akan menghapus semua sesi obrolan secara permanen dan tidak dapat dibatalkan.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowClearConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl glass text-xs font-semibold text-slate-300 hover:bg-white/10 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleClearAllHistory}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Ya, Hapus Semua
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── OpenRouter API Key Config Modal (Portal) ── */}
      {showKeyModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-sm glass-card rounded-3xl p-5 border border-white/15 shadow-2xl space-y-4 bg-[#0d0e1a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-key text-slate-300 text-sm" />
                  <h3 className="text-white font-bold text-sm">Konfigurasi OpenRouter API Key</h3>
                </div>
                <button onClick={() => setShowKeyModal(false)} className="text-white/40 hover:text-white">✕</button>
              </div>

              <p className="text-white/60 text-xs leading-relaxed">
                Masukkan <code className="bg-white/10 px-1 py-0.5 rounded text-slate-200">OPENROUTER_API_KEY</code> Anda dari{" "}
                <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer" className="text-slate-200 underline font-semibold hover:text-white">
                  openrouter.ai
                </a>{" "}
                untuk mengaktifkan respons AI via OpenRouter.
              </p>

              <div className="space-y-1">
                <label className="text-white/40 text-[10px] uppercase font-bold tracking-wider">API Key String</label>
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 font-mono"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTempKey("");
                    localStorage.removeItem("openrouter_api_key");
                    setApiKey("");
                    setShowKeyModal(false);
                    onShowToast("API Key dihapus", "info");
                  }}
                  className="px-3 py-2 rounded-xl glass text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-all"
                >
                  Hapus Key
                </button>

                <button
                  type="button"
                  onClick={saveApiKey}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95"
                >
                  Simpan Key
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── Floating AI Assistant Chat Launcher Component ─────────────────────────────
function FloatingAIChat({
  onOpenAITab,
}: {
  onOpenAITab: () => void;
}) {
  return (
    <button
      onClick={onOpenAITab}
      className="fixed bottom-20 right-5 z-40 px-3.5 py-2.5 rounded-2xl glass-strong border border-violet-400/40 text-white text-xs font-bold shadow-2xl shadow-violet-600/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 bg-gradient-to-r from-violet-600/80 to-indigo-600/80 backdrop-blur-xl group"
      title="Buka AI Assistant Chatbot"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
      <span className="text-base group-hover:rotate-12 transition-transform">🤖</span>
      <span className="tracking-wide">AI Chat</span>
    </button>
  );
}

// ─── Minimalist Modern Vector Icon Components ─────────────────────────────────
function IconHome({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function IconTransactions({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function IconBudget({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <i className={`fa-solid fa-chart-pie ${className} flex items-center justify-center text-sm`} />
  );
}

function IconSchedule({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconAI({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function IconBackend({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IconProfile({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

// ─── Dynamic API Base URL Helper ──────────────────────────────────────────────
export const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv.VITE_API_BASE_URL) {
      return metaEnv.VITE_API_BASE_URL.replace(/\/$/, "");
    }
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "/api/v1";
    }
  }
  return "http://localhost:5000/api/v1";
};

const API_BASE = getApiBaseUrl();

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [currency, setCurrency] = useState<Currency>("IDR");
  const [language, setLanguage] = useState<Lang>(() => {
    return (localStorage.getItem("mft_language") as Lang) || "ID";
  });
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
    return (localStorage.getItem("mft_theme_color") as ThemeColor) || "violet";
  });

  const handleToggleDarkMode = (val: boolean) => {
    setDarkMode(true);
    localStorage.setItem("mft_dark_mode", "true");
  };

  const handleThemeColorChange = (col: ThemeColor) => {
    setThemeColor(col);
    localStorage.setItem("mft_theme_color", col);
  };

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light-mode");
    localStorage.setItem("mft_dark_mode", "true");
  }, []);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" | "alert" } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ─── PIN Lock Security State & 5-Min Inactivity Auto-Lock ──────────────────
  const [pinLockEnabled, setPinLockEnabled] = useState<boolean>(() => {
    return localStorage.getItem("mft_pin_enabled") === "true";
  });
  const [userPin, setUserPin] = useState<string>(() => {
    return localStorage.getItem("mft_pin_code") || "";
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const enabled = localStorage.getItem("mft_pin_enabled") === "true";
    const pin = localStorage.getItem("mft_pin_code");
    return enabled && !!pin;
  });
  const [showSetupPinModal, setShowSetupPinModal] = useState<boolean>(false);
  const [showOtherToolsModal, setShowOtherToolsModal] = useState<boolean>(false);

  // Auto-lock after 5 minutes (300,000 ms) of user inactivity
  useEffect(() => {
    if (!pinLockEnabled || !userPin) return;

    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
      }, 5 * 60 * 1000); // 5 minutes inactivity
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [pinLockEnabled, userPin]);

  const handleUnlockWithPin = (enteredPin: string): boolean => {
    if (enteredPin === userPin) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const handleSaveNewPin = (newPin: string) => {
    setUserPin(newPin);
    setPinLockEnabled(true);
    localStorage.setItem("mft_pin_code", newPin);
    localStorage.setItem("mft_pin_enabled", "true");
    setShowSetupPinModal(false);
    showToast("Kunci PIN 4-Digit berhasil disimpan & diaktifkan 🔒", "success");
  };

  const handleTogglePinLock = (enabled: boolean) => {
    if (enabled) {
      if (!userPin) {
        setShowSetupPinModal(true);
      } else {
        setPinLockEnabled(true);
        localStorage.setItem("mft_pin_enabled", "true");
        showToast("Kunci PIN 4-Digit diaktifkan 🔒", "info");
      }
    } else {
      setPinLockEnabled(false);
      localStorage.setItem("mft_pin_enabled", "false");
      showToast("Kunci PIN dinonaktifkan", "info");
    }
  };

  // ─── PWA Installation State & Handler ──────────────────────────────────────
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [highlightGuide, setHighlightGuide] = useState<boolean>(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const hasDismissed = sessionStorage.getItem("pwa_install_dismissed");
      if (!hasDismissed) {
        setShowInstallModal(true);
      }
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      setShowInstallModal(false);
      showToast("Aplikasi berhasil dipasang di perangkat Anda! 🎉", "success");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          showToast("Proses instalasi dimulai! 🎉", "success");
          setIsAppInstalled(true);
        } else {
          showToast("Instalasi dibatalkan oleh pengguna.", "info");
        }
      } catch (err) {
        console.error("PWA install prompt error:", err);
      }
      setDeferredPrompt(null);
      setShowInstallModal(false);
    } else {
      setHighlightGuide(true);
      setTimeout(() => setHighlightGuide(false), 4000);
      showToast("Panduan: Tekan menu browser (⋮ / ⎘) lalu pilih 'Tambahkan ke Layar Utama' / 'Install App' 📱", "info");
    }
  };

  const handleLanguageChange = (newLang: Lang) => {
    setLanguage(newLang);
    localStorage.setItem("mft_language", newLang);
  };

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("mft_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Notification reminder preference (persisted)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("mft_notifications") === "true";
  });
  // Tracks which schedule events have already fired a reminder to avoid duplicates
  const notifiedRef = useRef<Set<string>>(new Set());

  // LocalStorage initial state persistence with backend sync override
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem("mft_transactions");
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [budget, setBudget] = useState<BudgetItem[]>(() => {
    const saved = localStorage.getItem("mft_budget");
    return saved ? JSON.parse(saved) : INITIAL_BUDGET;
  });

  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
    const saved = localStorage.getItem("mft_events");
    return saved ? JSON.parse(saved) : INITIAL_EVENTS;
  });

  // Save currentUser to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("mft_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("mft_user");
    }
  }, [currentUser]);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem("mft_transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("mft_budget", JSON.stringify(budget));
  }, [budget]);

  useEffect(() => {
    localStorage.setItem("mft_events", JSON.stringify(events));
  }, [events]);

  const showToast = (msg: string, type: "success" | "info" | "alert") => {
    setToast({ msg, type });
  };

  // ─── Notification Reminder Feature ──────────────────────────────────────────
  // Fire a native browser/desktop notification (with in-app toast fallback)
  const fireNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/favicon.ico", tag: title });
      } catch {
        showToast(`${title} — ${body}`, "info");
      }
    } else {
      showToast(`${title} — ${body}`, "info");
    }
  };

  // Toggle handler from Settings: request browser permission when enabling
  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      if (!("Notification" in window)) {
        showToast("Browser ini tidak mendukung notifikasi", "alert");
        return;
      }
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
        localStorage.setItem("mft_notifications", "true");
        showToast("Notifikasi pengingat diaktifkan", "success");
        return;
      }
      if (Notification.permission === "denied") {
        showToast("Izin notifikasi diblokir. Aktifkan lewat pengaturan browser Anda.", "alert");
        return;
      }
      // permission === "default" → prompt the user
      showToast("Menunggu izin notifikasi dari browser...", "info");
      try {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          setNotificationsEnabled(true);
          localStorage.setItem("mft_notifications", "true");
          showToast("Izin diberikan! Notifikasi pengingat aktif ✅", "success");
          new Notification("Pengingat Aktif 🔔", {
            body: "Anda akan menerima notifikasi saat jadwal tiba.",
          });
        } else {
          setNotificationsEnabled(false);
          localStorage.setItem("mft_notifications", "false");
          showToast("Izin notifikasi ditolak", "alert");
        }
      } catch {
        showToast("Gagal meminta izin notifikasi", "alert");
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem("mft_notifications", "false");
      showToast("Notifikasi pengingat dinonaktifkan", "info");
    }
  };

  // Poll every 15s: fire a reminder when an event's reminder time arrives
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkReminders = () => {
      const now = Date.now();
      events.forEach(ev => {
        if (ev.done || notifiedRef.current.has(ev.id)) return;
        if (!ev.date || !ev.time) return;

        const eventAt = new Date(`${ev.date}T${ev.time}:00`).getTime();
        if (isNaN(eventAt)) return;

        const lead = (ev.remindMinutes ?? 15) * 60_000;
        const remindAt = eventAt - lead;

        // Fire once the reminder moment has arrived and the event hasn't long passed.
        // The upper bound (event time + 60s grace) prevents spamming for old events
        // — e.g. right after enabling notifications or reloading with stale data.
        if (now >= remindAt && now <= eventAt + 60_000) {
          notifiedRef.current.add(ev.id);
          const timeLabel = now >= eventAt ? "sekarang" : `pukul ${ev.time}`;
          fireNotification(
            `🔔 Pengingat: ${ev.title}`,
            `Jadwal ${ev.type} Anda ${timeLabel}${ev.note ? ` — ${ev.note}` : ""}`
          );
        }
      });
    };

    checkReminders();
    const interval = setInterval(checkReminders, 15_000);
    return () => clearInterval(interval);
  }, [notificationsEnabled, events]);

  // Sync state with Live REST API Server
  const syncWithBackend = async (silent = false) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const headers = { "X-User-Id": currentUser.id };
      const healthRes = await fetch(`${API_BASE}/health`).catch(() => null);
      if (healthRes && healthRes.ok) {
        setApiConnected(true);
        const [txRes, bgRes, scRes] = await Promise.all([
          fetch(`${API_BASE}/transactions?userId=${currentUser.id}`, { headers }).catch(() => null),
          fetch(`${API_BASE}/budgets?userId=${currentUser.id}`, { headers }).catch(() => null),
          fetch(`${API_BASE}/schedules?userId=${currentUser.id}`, { headers }).catch(() => null),
        ]);

        if (txRes && txRes.ok) {
          const txData = await txRes.json();
          if (Array.isArray(txData.data)) setTransactions(txData.data);
        }
        if (bgRes && bgRes.ok) {
          const bgData = await bgRes.json();
          if (Array.isArray(bgData.data) && bgData.data.length > 0) setBudget(bgData.data);
        }
        if (scRes && scRes.ok) {
          const scData = await scRes.json();
          if (Array.isArray(scData.data)) setEvents(scData.data);
        }

        if (!silent) {
          showToast("Data pribadi berhasil tersinkronisasi dengan REST API Server", "success");
        }
      } else {
        setApiConnected(false);
        if (!silent) {
          showToast("Menggunakan Mode Offline (LocalStorage)", "info");
        }
      }
    } catch (err) {
      setApiConnected(false);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initial sync check on mount or when user changes
  useEffect(() => {
    if (currentUser) {
      syncWithBackend(true);
    }
  }, [currentUser?.id]);

  const handleLogout = () => {
    setCurrentUser(null);
    setTransactions([]);
    setEvents([]);
    localStorage.removeItem("mft_user");
    localStorage.removeItem("mft_transactions");
    localStorage.removeItem("mft_events");
    showToast("Anda telah keluar dari akun.", "info");
  };

  // CRUD Actions with API syncing
  const addTransaction = async (tx: Omit<Transaction, "id">) => {
    const newId = Date.now().toString();
    const newTx = { ...tx, id: newId, userId: currentUser?.id || "u1" };
    setTransactions(prev => [newTx, ...prev]);

    if (apiConnected) {
      try {
        await fetch(`${API_BASE}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": currentUser?.id || "" },
          body: JSON.stringify(newTx),
        });
      } catch (e) {
        console.warn("API Sync Failed, saved locally", e);
      }
    }
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (apiConnected) {
      try {
        await fetch(`${API_BASE}/transactions/${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("API Delete Failed", e);
      }
    }
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => (t.id === updatedTx.id ? updatedTx : t)));
    if (apiConnected) {
      try {
        await fetch(`${API_BASE}/transactions/${updatedTx.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-User-Id": currentUser?.id || "" },
          body: JSON.stringify(updatedTx),
        });
      } catch (e) {
        console.warn("API Update Failed", e);
      }
    }
  };

  const updateBudgetLimit = async (id: string, limit: number) => {
    setBudget(prev => {
      const updated = prev.map(b => (b.id === id ? { ...b, limit } : b));
      const target = updated.find(b => b.id === id);
      if (target && apiConnected) {
        fetch(`${API_BASE}/budgets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": currentUser?.id || "" },
          body: JSON.stringify({ ...target, userId: currentUser?.id }),
        }).catch(() => null);
      }
      return updated;
    });
  };

  const addBudget = async (b: Omit<BudgetItem, "id">) => {
    const newB = { ...b, id: Date.now().toString(), userId: currentUser?.id };
    setBudget(prev => [...prev, newB]);
    if (apiConnected) {
      try {
        await fetch(`${API_BASE}/budgets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": currentUser?.id || "" },
          body: JSON.stringify(newB),
        });
      } catch (e) {
        console.warn("API Add Budget Failed", e);
      }
    }
  };

  const deleteBudget = async (id: string) => {
    setBudget(prev => prev.filter(b => b.id !== id));
    if (apiConnected) {
      try {
        await fetch(`${API_BASE}/budgets/${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("API Delete Budget Failed", e);
      }
    }
  };

  const addEvent = async (ev: Omit<ScheduleEvent, "id">) => {
    const newEv = { ...ev, id: Date.now().toString(), userId: currentUser?.id };
    setEvents(prev => [...prev, newEv]);
    if (apiConnected) {
      try {
        await fetch(`${API_BASE}/schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": currentUser?.id || "" },
          body: JSON.stringify(newEv),
        });
      } catch (e) {
        console.warn("API Add Schedule Failed", e);
      }
    }
  };

  const toggleEvent = async (id: string) => {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, done: !e.done } : e)));
    if (apiConnected) {
      try {
        await fetch(`${API_BASE}/schedules/${id}/toggle`, { method: "PATCH" });
      } catch (e) {
        console.warn("API Toggle Schedule Failed", e);
      }
    }
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleResetData = () => {
    setShowResetConfirm(true);
  };

  const confirmResetData = () => {
    setTransactions([]);
    setEvents([]);
    localStorage.removeItem("mft_transactions");
    localStorage.removeItem("mft_events");
    setShowResetConfirm(false);
    showToast("Seluruh transaksi & catatan telah dibersihkan", "info");
  };

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "dashboard",    icon: <IconHome />,         label: t("nav_home", language) },
    { id: "transactions", icon: <IconTransactions />, label: t("nav_transactions", language) },
    { id: "budget",       icon: <IconBudget />,       label: t("nav_budget", language) },
    { id: "schedule",     icon: <IconSchedule />,     label: t("nav_schedule", language) },
    { id: "ai",           icon: <IconAI />,           label: t("nav_ai", language) },
    { id: "settings",     icon: <IconProfile />,      label: t("nav_profile", language) },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative font-sans overflow-hidden bg-[#050714] text-slate-100 dark">
      <AuroraBackground themeColor={themeColor} darkMode={true} />

      {/* PIN Lock Screen Overlay */}
      {isLocked && (
        <PinLockScreenModal
          onUnlock={handleUnlockWithPin}
          language={language}
        />
      )}

      {/* Setup 4-Digit PIN Modal */}
      <SetupPinModal
        isOpen={showSetupPinModal}
        onClose={() => setShowSetupPinModal(false)}
        onSavePin={handleSaveNewPin}
        language={language}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Reset All Data Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Hapus Seluruh Data"
        message="Semua transaksi dan catatan agenda pada akun ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus Semua"
        cancelText="Batal"
        onConfirm={confirmResetData}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Auth Screen Modal if user is not logged in */}
      {!currentUser && (
        <AuthModal
          onSuccess={(user) => {
            setCurrentUser(user);
          }}
          onShowToast={showToast}
        />
      )}

      {/* Other Tools & Utility Hub Modal */}
      <OtherToolsModal
        isOpen={showOtherToolsModal}
        onClose={() => setShowOtherToolsModal(false)}
        onShowToast={showToast}
        language={language}
      />

      {/* Main Web Container - Clean native layout without phone frame or notch */}
      <div className="relative flex flex-col w-full max-w-5xl h-screen md:h-[95vh] md:rounded-3xl border-0 md:border md:border-white/10 shadow-2xl glass-strong overflow-hidden z-10 transition-all duration-300">
        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === "dashboard" && (
            <DashboardTab
              transactions={transactions}
              events={events}
              budget={budget}
              currency={currency}
              language={language}
              currentUser={currentUser}
              onNavigate={setActiveTab}
              onOpenOtherTools={() => setShowOtherToolsModal(true)}
            />
          )}

          {activeTab === "transactions" && (
            <TransactionsTab
              transactions={transactions}
              currency={currency}
              language={language}
              onAdd={addTransaction}
              onUpdate={updateTransaction}
              onDelete={deleteTransaction}
              onShowToast={showToast}
            />
          )}

          {activeTab === "budget" && (
            <BudgetTab
              budget={budget}
              transactions={transactions}
              currency={currency}
              language={language}
              onUpdateLimit={updateBudgetLimit}
              onAddBudget={addBudget}
              onDeleteBudget={deleteBudget}
              onShowToast={showToast}
            />
          )}

          {activeTab === "schedule" && (
            <ScheduleTab
              events={events}
              language={language}
              onAdd={addEvent}
              onToggle={toggleEvent}
              onDelete={deleteEvent}
              onShowToast={showToast}
            />
          )}

          {activeTab === "ai" && (
            <AiTab
              transactions={transactions}
              budget={budget}
              events={events}
              currentUser={currentUser}
              currency={currency}
              darkMode={darkMode}
              onShowToast={showToast}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              currentUser={currentUser}
              currency={currency}
              onCurrencyChange={setCurrency}
              onResetData={handleResetData}
              onLogout={handleLogout}
              onShowToast={showToast}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={handleToggleNotifications}
              transactions={transactions}
              budget={budget}
              events={events}
              language={language}
              onLanguageChange={handleLanguageChange}
              onOpenInstallModal={() => setShowInstallModal(true)}
              onUpdateUser={(updated) => {
                setCurrentUser(updated);
                localStorage.setItem("mft_user", JSON.stringify(updated));
              }}
              darkMode={darkMode}
              onToggleDarkMode={handleToggleDarkMode}
              themeColor={themeColor}
              onThemeColorChange={handleThemeColorChange}
              pinLockEnabled={pinLockEnabled}
              onTogglePinLock={handleTogglePinLock}
              onOpenSetupPinModal={() => setShowSetupPinModal(true)}
            />
          )}
        </div>

        {/* Floating Bottom Navigation Bar (Long Oval Capsule Dock over Page Content) */}
        <div className="absolute bottom-3 left-0 right-0 z-30 px-4 pointer-events-none">
          <div className="flex items-center justify-between rounded-full p-1.5 bg-[#0b0d1e]/85 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.8)] relative max-w-md mx-auto pointer-events-auto bottom-dock-container">
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all duration-300 relative group ${
                    active ? "text-white font-bold" : "text-white/40 hover:text-white/80 bottom-dock-inactive"
                  }`}
                >
                  {/* Active Floating Item Pill Background Glow */}
                  {active && (
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${THEME_STYLES[themeColor].gradient} ${THEME_STYLES[themeColor].glow} border border-white/20 animate-fade-in -z-0`} />
                  )}

                  <div
                    className={`transition-all duration-300 relative z-10 ${
                      active ? "scale-110 -translate-y-0.5 text-white preserve-white" : "group-hover:scale-105"
                    }`}
                  >
                    {tab.icon}
                  </div>
                  <span
                    className={`text-[10px] tracking-tight relative z-10 mt-0.5 transition-all ${
                      active ? "text-white font-extrabold preserve-white" : "font-medium"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PWA Installation Modal Portal */}
        {showInstallModal &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-sm bg-[#0d0f1c] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden text-left">
                {/* Background ambient glow */}
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-violet-600/30 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-600/20 rounded-full blur-2xl pointer-events-none" />

                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowInstallModal(false);
                    sessionStorage.setItem("pwa_install_dismissed", "true");
                  }}
                  className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors p-1.5 rounded-full bg-white/5 hover:bg-white/10"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>

                {/* Header Badge & Icon */}
                <div className="flex flex-col items-center text-center space-y-3 pt-1">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-purple-500 p-0.5 shadow-xl shadow-violet-500/25 flex items-center justify-center">
                    <div className="w-full h-full bg-[#0b0c16] rounded-[14px] flex items-center justify-center text-2xl text-white">
                      <i className="fa-solid fa-mobile-screen-button text-violet-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-extrabold text-lg tracking-tight">
                      Install Finance Tracker
                    </h3>
                    <p className="text-white/60 text-xs mt-1 leading-relaxed">
                      Pasang aplikasi di layar utama perangkat Anda untuk akses instan 1-klik, performa lebih cepat, dan dukungan offline!
                    </p>
                  </div>
                </div>

                {/* Features List */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <i className="fa-solid fa-bolt text-amber-400 text-xs w-4 text-center" />
                    <span>Akses cepat tanpa perlu membuka browser</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <i className="fa-solid fa-cloud-arrow-down text-emerald-400 text-xs w-4 text-center" />
                    <span>Dapat dibuka luring (offline caching)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <i className="fa-solid fa-shield-halved text-indigo-400 text-xs w-4 text-center" />
                    <span>Tampilan penuh seperti aplikasi native</span>
                  </div>
                </div>

                {/* iOS Instructions or Native Install Button */}
                <div className="space-y-3 pt-1">
                  <button
                    onClick={handleInstallApp}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white font-extrabold text-xs shadow-lg shadow-violet-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/20"
                  >
                    <i className="fa-solid fa-download" />
                    <span>Install Sekarang</span>
                  </button>

                  <div className={`transition-all duration-300 rounded-xl p-3 text-[11px] space-y-1 ${
                    highlightGuide
                      ? "bg-violet-900/60 border-2 border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.8)] scale-[1.02]"
                      : "bg-violet-950/30 border border-violet-500/20 text-violet-200"
                  }`}>
                    <p className="font-bold flex items-center gap-1.5 text-violet-300">
                      <i className={`fa-solid fa-circle-info text-xs ${highlightGuide ? "animate-bounce text-amber-300" : ""}`} />
                      Panduan Browser / iOS:
                    </p>
                    <p className="text-white/80 leading-normal">
                      Tekan menu browser (<i className="fa-solid fa-ellipsis-vertical" /> / <i className="fa-solid fa-share-nodes" />) lalu pilih <span className="font-bold text-amber-300">"Tambahkan ke Layar Utama"</span> atau <span className="font-bold text-amber-300">"Install Aplikasi"</span>.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowInstallModal(false);
                      sessionStorage.setItem("pwa_install_dismissed", "true");
                    }}
                    className="w-full py-2 rounded-xl bg-white/5 text-white/50 font-semibold text-xs hover:bg-white/10 hover:text-white transition-all text-center"
                  >
                    Nanti Saja
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
