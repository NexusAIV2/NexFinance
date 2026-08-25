import React, { useState, useEffect, useRef } from "react";
import {
  shinigami,
  MangaItem,
  ChapterItem,
  ReadingChapterData,
} from "./shinigami";

interface ShinigamiReaderProps {
  onShowToast: (msg: string, type: "success" | "error" | "info" | "alert") => void;
  onCloseModal?: () => void;
}

interface SavedBookmark {
  manga_id: string;
  title: string;
  cover_portrait_url?: string;
  cover_image_url?: string;
  last_chapter_id?: string;
  last_chapter_number?: number;
  updated_at: number;
}

export default function ShinigamiReader({ onShowToast, onCloseModal }: ShinigamiReaderProps) {
  // Hub Navigation State
  const [activeTab, setActiveTab] = useState<"top" | "recommended" | "discover" | "bookmarks">("top");
  
  // Top Filter
  const [topFilter, setTopFilter] = useState<"daily" | "weekly" | "all_time">("daily");
  
  // Recommended Filter
  const [recmFormat, setRecmFormat] = useState<"manhwa" | "manga" | "manhua">("manhwa");
  
  // Discover & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Data Loading State
  const [mangaList, setMangaList] = useState<MangaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Manga & Detail Modal State
  const [selectedManga, setSelectedManga] = useState<MangaItem | null>(null);
  const [mangaDetail, setMangaDetail] = useState<MangaItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chapterSort, setChapterSort] = useState<"desc" | "asc">("desc");
  const [chapterFilter, setChapterFilter] = useState("");

  // Reading Chapter State & Fullscreen Overlay
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [readingData, setReadingData] = useState<ReadingChapterData | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [isFullscreenReader, setIsFullscreenReader] = useState(false);

  // Reader Settings
  const [readerMode, setReaderMode] = useState<"webtoon" | "paged">("webtoon");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [readerTheme, setReaderTheme] = useState<"dark" | "black" | "sepia">("dark");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showReaderHeader, setShowReaderHeader] = useState(true);

  // Saved Bookmarks / History (localStorage)
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>(() => {
    try {
      const saved = localStorage.getItem("shinigami_bookmarks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);

  // Save Bookmarks to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem("shinigami_bookmarks", JSON.stringify(bookmarks));
    } catch (e) {
      console.error("Failed to save bookmarks:", e);
    }
  }, [bookmarks]);

  // Escape key to exit reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreenReader) {
        setIsFullscreenReader(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreenReader]);

  // Load Manga List based on Active Tab & Filters
  useEffect(() => {
    loadMangaList();
  }, [activeTab, topFilter, recmFormat, page]);

  // Handle Search Debounce
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const handler = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(handler);
    } else if (activeTab === "discover") {
      loadMangaList();
    }
  }, [searchQuery]);

  const loadMangaList = async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (activeTab === "top") {
        res = await shinigami.getTop(topFilter, page, 16);
      } else if (activeTab === "recommended") {
        res = await shinigami.getRecommended(recmFormat, page, 16);
      } else if (activeTab === "discover") {
        if (searchQuery.trim()) {
          res = await shinigami.search(searchQuery.trim(), page, 16);
        } else {
          res = await shinigami.discover(page, 16);
        }
      } else if (activeTab === "bookmarks") {
        setMangaList([]);
        setLoading(false);
        return;
      }

      if (res && res.retcode === 0 && res.data) {
        setMangaList(res.data);
        if (res.meta?.total_page) {
          setTotalPages(res.meta.total_page);
        }
      } else {
        setError(res?.message || "Gagal memuat daftar manga.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setActiveTab("discover");
    setPage(1);
    setLoading(true);
    setError(null);
    try {
      const res = await shinigami.search(searchQuery.trim(), 1, 16);
      if (res && res.retcode === 0 && res.data) {
        setMangaList(res.data);
        setTotalPages(res.meta?.total_page || 1);
      } else {
        setError(res?.message || "Manga tidak ditemukan.");
      }
    } catch (err: any) {
      setError(err.message || "Gagal melakukan pencarian.");
    } finally {
      setLoading(false);
    }
  };

  // Open Manga Detail Modal
  const openMangaDetail = async (manga: MangaItem) => {
    setSelectedManga(manga);
    setMangaDetail(manga);
    setDetailLoading(true);
    setChaptersLoading(true);
    setChapters([]);

    try {
      // Fetch full detail
      const detailRes = await shinigami.detail(manga.manga_id);
      if (detailRes.retcode === 0 && detailRes.data) {
        setMangaDetail(detailRes.data);
      }

      // Fetch chapter list
      const chapterRes = await shinigami.chapter(manga.manga_id, chapterSort);
      if (chapterRes.retcode === 0 && chapterRes.data) {
        setChapters(chapterRes.data);
      }
    } catch (err: any) {
      onShowToast("Gagal memuat detail chapter.", "error");
    } finally {
      setDetailLoading(false);
      setChaptersLoading(false);
    }
  };

  // Toggle Chapter Sort (asc/desc)
  const toggleChapterSort = async () => {
    const newSort = chapterSort === "desc" ? "asc" : "desc";
    setChapterSort(newSort);
    if (selectedManga) {
      setChaptersLoading(true);
      try {
        const chapterRes = await shinigami.chapter(selectedManga.manga_id, newSort);
        if (chapterRes.retcode === 0 && chapterRes.data) {
          setChapters(chapterRes.data);
        }
      } catch {
        // ignore
      } finally {
        setChaptersLoading(false);
      }
    }
  };

  // Open Reading Chapter Overlay
  const startReadingChapter = async (chapterId: string) => {
    setActiveChapterId(chapterId);
    setReadingLoading(true);
    setIsFullscreenReader(true);
    setCurrentPageIndex(0);

    try {
      const res = await shinigami.reading(chapterId);
      if (res.retcode === 0 && res.data) {
        setReadingData(res.data);
        onShowToast(`Chapter ${res.data.chapter_number} berhasil dimuat ✨`, "success");

        // Save to bookmarks / history
        if (selectedManga) {
          saveBookmark(selectedManga, chapterId, res.data.chapter_number);
        }
      } else {
        onShowToast(res.message || "Gagal memuat gambar chapter.", "error");
      }
    } catch (err: any) {
      onShowToast(err.message || "Gagal membuka chapter.", "error");
    } finally {
      setReadingLoading(false);
    }
  };

  // Bookmark Toggle
  const isBookmarked = (mangaId: string) => {
    return bookmarks.some((b) => b.manga_id === mangaId);
  };

  const toggleBookmark = (manga: MangaItem) => {
    if (isBookmarked(manga.manga_id)) {
      setBookmarks(bookmarks.filter((b) => b.manga_id !== manga.manga_id));
      onShowToast(`"${manga.title}" dihapus dari favorit.`, "info");
    } else {
      const newBm: SavedBookmark = {
        manga_id: manga.manga_id,
        title: manga.title,
        cover_portrait_url: manga.cover_portrait_url || manga.cover_image_url,
        cover_image_url: manga.cover_image_url,
        updated_at: Date.now(),
      };
      setBookmarks([newBm, ...bookmarks]);
      onShowToast(`"${manga.title}" ditambahkan ke favorit! ❤️`, "success");
    }
  };

  const saveBookmark = (manga: MangaItem, chapterId: string, chapterNumber: number) => {
    setBookmarks((prev) => {
      const existing = prev.find((b) => b.manga_id === manga.manga_id);
      const updatedItem: SavedBookmark = {
        manga_id: manga.manga_id,
        title: manga.title,
        cover_portrait_url: manga.cover_portrait_url || manga.cover_image_url,
        cover_image_url: manga.cover_image_url,
        last_chapter_id: chapterId,
        last_chapter_number: chapterNumber,
        updated_at: Date.now(),
      };
      if (existing) {
        return [updatedItem, ...prev.filter((b) => b.manga_id !== manga.manga_id)];
      } else {
        return [updatedItem, ...prev];
      }
    });
  };

  // Handle Fullscreen Scroll Auto-hide Header
  const handleReaderScroll = () => {
    if (!readerContainerRef.current) return;
    const currentScrollTop = readerContainerRef.current.scrollTop;
    if (currentScrollTop > lastScrollTopRef.current && currentScrollTop > 100) {
      setShowReaderHeader(false);
    } else {
      setShowReaderHeader(true);
    }
    lastScrollTopRef.current = currentScrollTop;
  };

  // Handle Mouse Drag to Scroll Horizontal Tabs
  const handleMouseDownDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const ele = e.currentTarget;
    const startX = e.pageX - ele.offsetLeft;
    const scrollLeft = ele.scrollLeft;

    const handleMouseMove = (ev: MouseEvent) => {
      const x = ev.pageX - ele.offsetLeft;
      const walk = (x - startX) * 1.5;
      ele.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Filtered Chapters based on Search Filter
  const filteredChapters = chapters.filter((c) => {
    if (!chapterFilter.trim()) return true;
    return String(c.chapter_number).includes(chapterFilter.trim()) ||
      (c.chapter_title && c.chapter_title.toLowerCase().includes(chapterFilter.toLowerCase()));
  });

  return (
    <div className="space-y-6 text-white animate-fade-in font-sans">
      {/* ─── Top Header & Spotlight Banner ────────────────────────────────────── */}
      <div className="relative rounded-3xl p-6 overflow-hidden border border-rose-500/30 bg-gradient-to-r from-slate-950 via-rose-950/40 to-purple-950/60 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 tracking-wider">
                Shinigami Reader v1.0
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ⭐ Manhwa & Manga Hub
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Shinigami Manhwa & Manga Reader</span>
            </h2>
            <p className="text-white/60 text-xs max-w-xl leading-relaxed">
              Baca ribuan Manhwa, Manga, & Manhua favorit langsung di aplikasi dengan reader fullscreen responsif, bookmark otomatis, dan pembaruan chapter tercepat.
            </p>
          </div>

          {/* Search Bar Input */}
          <div className="w-full md:w-72 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari judul manga / manhwa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-rose-400 focus:bg-white/15 transition-all shadow-inner"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-white/50 text-xs" />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); loadMangaList(); }}
                  className="absolute right-3 top-2.5 text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs & Filters ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        {/* Main Tabs */}
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          onMouseDown={handleMouseDownDrag}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full cursor-grab active:cursor-grabbing select-none flex-nowrap"
        >
          <button
            onClick={() => { setActiveTab("top"); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === "top"
                ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-500/30 scale-105"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-fire text-amber-400" />
            <span>Top Ranking</span>
          </button>

          <button
            onClick={() => { setActiveTab("recommended"); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === "recommended"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 scale-105"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-thumbs-up text-purple-300" />
            <span>Rekomendasi</span>
          </button>

          <button
            onClick={() => { setActiveTab("discover"); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === "discover"
                ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-500/30 scale-105"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-compass text-sky-300" />
            <span>Discover</span>
          </button>

          <button
            onClick={() => setActiveTab("bookmarks")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === "bookmarks"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-bookmark text-amber-300" />
            <span>Favorit ({bookmarks.length})</span>
          </button>
        </div>

        {/* Sub Filters based on Active Tab */}
        <div className="flex items-center gap-2 justify-end">
          {activeTab === "top" && (
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {(["daily", "weekly", "all_time"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setTopFilter(f); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                    topFilter === f
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {f === "daily" ? "Harian" : f === "weekly" ? "Mingguan" : "Semua"}
                </button>
              ))}
            </div>
          )}

          {activeTab === "recommended" && (
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {(["manhwa", "manga", "manhua"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => { setRecmFormat(fmt); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                    recmFormat === fmt
                      ? "bg-purple-500 text-white shadow-md shadow-purple-500/30"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Content Grid / Bookmarks ──────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-3 space-y-3 animate-pulse border border-white/10">
              <div className="w-full h-48 bg-white/10 rounded-xl" />
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-center space-y-3 my-4">
          <i className="fa-solid fa-triangle-exclamation text-rose-400 text-3xl" />
          <p className="text-sm font-bold text-rose-200">{error}</p>
          <button
            onClick={() => loadMangaList()}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition-all"
          >
            Coba Lagi
          </button>
        </div>
      ) : activeTab === "bookmarks" ? (
        bookmarks.length === 0 ? (
          <div className="py-16 text-center space-y-3 glass-card rounded-3xl border border-white/10 my-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 text-2xl">
              <i className="fa-regular fa-bookmark" />
            </div>
            <h3 className="text-white font-extrabold text-base">Belum Ada Favorit</h3>
            <p className="text-white/50 text-xs max-w-sm mx-auto">
              Simpan manhwa atau manga yang sedang Anda baca dengan menekan tombol favorit untuk mengaksesnya dengan cepat di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {bookmarks.map((bm) => (
              <div
                key={bm.manga_id}
                onClick={() => openMangaDetail({ manga_id: bm.manga_id, title: bm.title, cover_portrait_url: bm.cover_portrait_url })}
                className="glass-card rounded-2xl p-3 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 cursor-pointer transition-all group relative overflow-hidden flex flex-col justify-between space-y-2"
              >
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 shadow-md">
                  {bm.cover_portrait_url || bm.cover_image_url ? (
                    <img
                      src={bm.cover_portrait_url || bm.cover_image_url}
                      alt={bm.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-3xl">
                      <i className="fa-solid fa-book" />
                    </div>
                  )}
                  {bm.last_chapter_number && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-950/80 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                      Terakhir: Ch. {bm.last_chapter_number}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBookmarks(bookmarks.filter((b) => b.manga_id !== bm.manga_id));
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <h4 className="text-white font-bold text-xs line-clamp-1 group-hover:text-amber-300 transition-colors">
                    {bm.title}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )
      ) : mangaList.length === 0 ? (
        <div className="py-12 text-center text-white/50 text-xs">Tidak ada data manga ditemukan.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {mangaList.map((manga) => (
            <div
              key={manga.manga_id}
              onClick={() => openMangaDetail(manga)}
              className="glass-card rounded-2xl p-3 border border-white/10 hover:border-rose-500/50 hover:bg-rose-500/10 cursor-pointer transition-all group flex flex-col justify-between space-y-2 relative overflow-hidden"
            >
              {/* Cover Art */}
              <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 shadow-md">
                {manga.cover_portrait_url || manga.cover_image_url ? (
                  <img
                    src={manga.cover_portrait_url || manga.cover_image_url}
                    alt={manga.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-3xl">
                    <i className="fa-solid fa-book" />
                  </div>
                )}

                {/* Rating Badge */}
                {manga.user_rate && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-black bg-slate-950/80 text-amber-300 border border-amber-500/30 backdrop-blur-md flex items-center gap-1">
                    <i className="fa-solid fa-star text-amber-400" />
                    <span>{manga.user_rate}</span>
                  </span>
                )}

                {/* Chapter Badge */}
                {manga.latest_chapter_number && (
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-600/90 text-white backdrop-blur-md shadow-md">
                    Ch. {manga.latest_chapter_number}
                  </span>
                )}

                {/* Bookmark indicator */}
                {isBookmarked(manga.manga_id) && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] shadow-md">
                    <i className="fa-solid fa-bookmark" />
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="space-y-1">
                <h4 className="text-white font-bold text-xs line-clamp-1 group-hover:text-rose-300 transition-colors">
                  {manga.title}
                </h4>
                {manga.alternative_title && (
                  <p className="text-white/40 text-[10px] line-clamp-1">{manga.alternative_title}</p>
                )}
                <div className="flex items-center justify-between text-[10px] text-white/40 font-mono pt-1">
                  <span>{manga.release_year || "2024"}</span>
                  {manga.view_count && (
                    <span className="flex items-center gap-1">
                      <i className="fa-regular fa-eye text-white/30" />
                      {manga.view_count > 1000000
                        ? `${(manga.view_count / 1000000).toFixed(1)}M`
                        : `${(manga.view_count / 1000).toFixed(0)}K`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Pagination ─────────────────────────────────────────────────────── */}
      {activeTab !== "bookmarks" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white/70 hover:text-white disabled:opacity-30 text-xs font-bold transition-all"
          >
            ← Halaman Sebelum
          </button>
          <span className="text-xs font-mono text-white/60">
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white/70 hover:text-white disabled:opacity-30 text-xs font-bold transition-all"
          >
            Halaman Berikut →
          </button>
        </div>
      )}

      {/* ─── Manga Detail Modal ───────────────────────────────────────────────── */}
      {selectedManga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] rounded-3xl border border-white/20 overflow-hidden flex flex-col shadow-2xl relative">
            {/* Header / Backdrop Image */}
            <div className="relative h-44 sm:h-56 bg-slate-950 overflow-hidden flex-shrink-0">
              {selectedManga.cover_image_url || selectedManga.cover_portrait_url ? (
                <img
                  src={selectedManga.cover_image_url || selectedManga.cover_portrait_url}
                  alt="Cover Backdrop"
                  className="w-full h-full object-cover opacity-30 blur-md scale-110"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-rose-950 to-purple-950 opacity-50" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

              {/* Close Button */}
              <button
                onClick={() => setSelectedManga(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center text-sm font-bold transition-colors z-20"
              >
                ✕
              </button>

              {/* Content Overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4 z-10">
                <div className="w-24 sm:w-32 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 flex-shrink-0">
                  {selectedManga.cover_portrait_url || selectedManga.cover_image_url ? (
                    <img
                      src={selectedManga.cover_portrait_url || selectedManga.cover_image_url}
                      alt={selectedManga.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-3xl">
                      <i className="fa-solid fa-book" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1 text-shadow">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-rose-500 text-white shadow-md">
                      {mangaDetail?.taxonomy?.Format?.[0]?.name || "MANHWA"}
                    </span>
                    {mangaDetail?.user_rate && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40">
                        ⭐ {mangaDetail.user_rate}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black text-white line-clamp-1">
                    {selectedManga.title}
                  </h3>
                  {selectedManga.alternative_title && (
                    <p className="text-white/60 text-xs line-clamp-1">{selectedManga.alternative_title}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 tab-scroll">
              {/* Action Buttons & Quick Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBookmark(selectedManga)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      isBookmarked(selectedManga.manga_id)
                        ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/15"
                    }`}
                  >
                    <i className={`fa-${isBookmarked(selectedManga.manga_id) ? "solid" : "regular"} fa-bookmark`} />
                    <span>{isBookmarked(selectedManga.manga_id) ? "Tersimpan di Favorit" : "Tambah Favorit"}</span>
                  </button>

                  {chapters.length > 0 && (
                    <button
                      onClick={() => startReadingChapter(chapters[chapters.length - 1].chapter_id)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-rose-500/30 transition-all flex items-center gap-2"
                    >
                      <i className="fa-solid fa-play" />
                      <span>Mulai Baca Ch. 1</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-white/60 font-mono">
                  {mangaDetail?.view_count && (
                    <span>👁️ {(mangaDetail.view_count / 1000).toFixed(0)}K views</span>
                  )}
                  {chapters.length > 0 && <span>📚 {chapters.length} Chapter</span>}
                </div>
              </div>

              {/* Synopsis */}
              {mangaDetail?.description && (
                <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <h4 className="text-white/60 text-[10px] font-extrabold uppercase tracking-wider">Sinopsis</h4>
                  <p className="text-white/80 text-xs leading-relaxed whitespace-pre-line">
                    {mangaDetail.description}
                  </p>
                </div>
              )}

              {/* Genres */}
              {mangaDetail?.taxonomy?.Genre && mangaDetail.taxonomy.Genre.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {mangaDetail.taxonomy.Genre.map((g) => (
                    <span
                      key={g.taxonomy_id}
                      className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white/10 text-rose-300 border border-white/10"
                    >
                      #{g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Chapter Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-white font-extrabold text-sm flex items-center gap-2">
                    <i className="fa-solid fa-list-ol text-rose-400" />
                    <span>Daftar Chapter ({filteredChapters.length})</span>
                  </h4>

                  <div className="flex items-center gap-2">
                    {/* Chapter Filter Search */}
                    <input
                      type="text"
                      placeholder="Cari Ch..."
                      value={chapterFilter}
                      onChange={(e) => setChapterFilter(e.target.value)}
                      className="w-24 bg-white/5 border border-white/15 rounded-xl px-2.5 py-1 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-rose-400"
                    />

                    {/* Sort Order Toggle */}
                    <button
                      onClick={toggleChapterSort}
                      className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 text-[11px] font-bold transition-all flex items-center gap-1"
                    >
                      <i className={`fa-solid fa-sort-amount-${chapterSort === "desc" ? "down" : "up"}`} />
                      <span>{chapterSort === "desc" ? "Terbaru" : "Terlama"}</span>
                    </button>
                  </div>
                </div>

                {chaptersLoading ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-white/50">Memuat daftar chapter...</p>
                  </div>
                ) : filteredChapters.length === 0 ? (
                  <div className="py-6 text-center text-white/40 text-xs">Tidak ada chapter ditemukan.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto tab-scroll pr-1">
                    {filteredChapters.map((ch) => (
                      <button
                        key={ch.chapter_id}
                        onClick={() => startReadingChapter(ch.chapter_id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                          activeChapterId === ch.chapter_id
                            ? "bg-rose-500/20 border-rose-500/60 text-rose-300"
                            : "bg-white/5 border-white/10 hover:bg-rose-500/10 hover:border-rose-500/40 text-white"
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-xs group-hover:text-rose-300 transition-colors">
                            Chapter {ch.chapter_number}
                            {ch.chapter_title && <span className="font-normal text-white/60 ml-2">{ch.chapter_title}</span>}
                          </div>
                          {ch.release_date && (
                            <div className="text-[10px] text-white/40 font-mono mt-0.5">
                              {new Date(ch.release_date).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          )}
                        </div>
                        <i className="fa-solid fa-chevron-right text-white/30 group-hover:text-rose-400 text-xs group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 100% FULLSCREEN MANGA READER OVERLAY ─────────────────────────────── */}
      {isFullscreenReader && (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col transition-colors duration-300 ${
            readerTheme === "black"
              ? "bg-black text-white"
              : readerTheme === "sepia"
              ? "bg-[#1c1917] text-amber-100"
              : "bg-[#0b0f19] text-white"
          }`}
        >
          {/* Reader Top Header Bar */}
          <div
            className={`transition-all duration-300 z-50 p-3.5 border-b flex items-center justify-between gap-3 ${
              showReaderHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
            } ${
              readerTheme === "sepia"
                ? "bg-[#292524] border-stone-800"
                : "bg-slate-950/90 border-white/10 backdrop-blur-xl"
            }`}
          >
            {/* Left: Manga info & Chapter Number */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsFullscreenReader(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center text-sm font-bold transition-all flex-shrink-0"
                title="Tutup Reader"
              >
                ✕
              </button>
              <div className="min-w-0">
                <h4 className="font-extrabold text-xs sm:text-sm truncate text-white">
                  {selectedManga?.title || "Shinigami Reader"}
                </h4>
                {readingData && (
                  <p className="text-rose-400 text-[11px] font-bold font-mono">
                    Chapter {readingData.chapter_number}
                  </p>
                )}
              </div>
            </div>

            {/* Center / Right Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Reader Mode Toggle (Webtoon vs Paged) */}
              <div className="hidden sm:flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setReaderMode("webtoon")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    readerMode === "webtoon" ? "bg-rose-500 text-white" : "text-white/60 hover:text-white"
                  }`}
                  title="Webtoon Mode (Continuous Scroll)"
                >
                  📜 Webtoon
                </button>
                <button
                  onClick={() => setReaderMode("paged")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    readerMode === "paged" ? "bg-rose-500 text-white" : "text-white/60 hover:text-white"
                  }`}
                  title="Paged Mode (Single Page)"
                >
                  📖 Per Halaman
                </button>
              </div>

              {/* Theme Selector */}
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setReaderTheme("dark")}
                  className={`w-6 h-6 rounded-md bg-[#0b0f19] border ${
                    readerTheme === "dark" ? "border-rose-400" : "border-white/20"
                  }`}
                  title="Dark Theme"
                />
                <button
                  onClick={() => setReaderTheme("black")}
                  className={`w-6 h-6 rounded-md bg-black border ${
                    readerTheme === "black" ? "border-rose-400" : "border-white/20"
                  }`}
                  title="Pitch Black Theme"
                />
                <button
                  onClick={() => setReaderTheme("sepia")}
                  className={`w-6 h-6 rounded-md bg-[#1c1917] border ${
                    readerTheme === "sepia" ? "border-rose-400" : "border-white/20"
                  }`}
                  title="Warm Sepia Theme"
                />
              </div>

              {/* Zoom controls */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
                >
                  -
                </button>
                <span className="text-[10px] font-mono text-white/70 w-8 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(160, z + 15))}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Reader Body Image Container */}
          <div
            ref={readerContainerRef}
            onScroll={handleReaderScroll}
            className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 flex flex-col items-center tab-scroll space-y-1"
          >
            {readingLoading ? (
              <div className="my-auto py-24 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <h3 className="text-white font-extrabold text-base">Memuat Halaman Chapter...</h3>
                <p className="text-white/50 text-xs">Menghubungkan ke server CDN Shinigami</p>
              </div>
            ) : !readingData || readingData.images.length === 0 ? (
              <div className="my-auto py-16 text-center space-y-3">
                <i className="fa-solid fa-image-slash text-rose-400 text-4xl" />
                <p className="text-sm font-bold text-white">Gambar chapter tidak tersedia.</p>
                <button
                  onClick={() => activeChapterId && startReadingChapter(activeChapterId)}
                  className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs"
                >
                  Muat Ulang
                </button>
              </div>
            ) : readerMode === "webtoon" ? (
              <div
                className="flex flex-col items-center space-y-1 transition-all duration-200 mx-auto"
                style={{ width: `${zoomLevel}%`, maxWidth: `${Math.min(100, zoomLevel)}%` }}
              >
                {readingData.images.map((imgUrl, idx) => (
                  <div key={idx} className="relative w-full max-w-2xl bg-slate-900/40 rounded-sm overflow-hidden min-h-[300px]">
                    <img
                      src={imgUrl}
                      alt={`Halaman ${idx + 1}`}
                      className="w-full h-auto object-contain block mx-auto shadow-lg"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback retry
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[9px] font-mono bg-black/60 text-white/60">
                      {idx + 1} / {readingData.images.length}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Paged Mode */
              <div className="my-auto flex flex-col items-center space-y-3">
                <div
                  className="relative max-w-3xl bg-slate-900/40 rounded-lg overflow-hidden shadow-2xl"
                  style={{ width: `${zoomLevel}%` }}
                >
                  <img
                    src={readingData.images[currentPageIndex]}
                    alt={`Halaman ${currentPageIndex + 1}`}
                    className="w-full h-auto object-contain max-h-[80vh] mx-auto"
                  />
                  <span className="absolute bottom-3 right-3 px-3 py-1 rounded-xl text-xs font-mono font-bold bg-black/80 text-rose-300 backdrop-blur-md">
                    {currentPageIndex + 1} / {readingData.images.length}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                    disabled={currentPageIndex === 0}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs disabled:opacity-30"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="text-xs font-mono text-white/60">
                    {currentPageIndex + 1} of {readingData.images.length}
                  </span>
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.min(readingData.images.length - 1, p + 1))}
                    disabled={currentPageIndex === readingData.images.length - 1}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs disabled:opacity-30"
                  >
                    Selanjutnya →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reader Bottom Navigation Bar */}
          {readingData && (
            <div className="p-3 bg-slate-950/95 border-t border-white/10 flex items-center justify-between gap-3 z-50">
              {/* Prev Chapter */}
              <button
                onClick={() => readingData.prev_chapter_id && startReadingChapter(readingData.prev_chapter_id)}
                disabled={!readingData.prev_chapter_id}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-rose-600 disabled:opacity-30 text-white font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <i className="fa-solid fa-chevron-left" />
                <span>Ch. {readingData.prev_chapter_number || "Sebelumnya"}</span>
              </button>

              {/* Chapter Quick Switcher */}
              <div className="text-xs font-mono text-white/80 font-extrabold bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                Chapter {readingData.chapter_number}
              </div>

              {/* Next Chapter */}
              <button
                onClick={() => readingData.next_chapter_id && startReadingChapter(readingData.next_chapter_id)}
                disabled={!readingData.next_chapter_id}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-30 text-white font-bold text-xs shadow-lg shadow-rose-500/30 transition-all flex items-center gap-1.5"
              >
                <span>Ch. {readingData.next_chapter_number || "Selanjutnya"}</span>
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
