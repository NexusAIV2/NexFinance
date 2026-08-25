import React, { useState, useEffect, useRef } from "react";
import {
  getHome,
  searchAnime,
  getDetail,
  AnimeItem,
  AnimeDetail,
  EpisodeItem,
} from "./anichin";

interface AnichinStreamerProps {
  onShowToast: (msg: string, type: "success" | "error" | "info" | "alert") => void;
  onCloseModal?: () => void;
}

interface WatchlistItem {
  judul: string;
  url: string;
  thumbnail: string;
  last_episode?: string;
  updated_at: number;
}

export default function AnichinStreamer({ onShowToast, onCloseModal }: AnichinStreamerProps) {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<"home" | "search" | "watchlist">("home");

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AnimeItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Home State
  const [homeList, setHomeList] = useState<AnimeItem[]>([]);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  // Selected Detail & Streaming Player State
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [animeDetail, setAnimeDetail] = useState<AnimeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeEpUrl, setActiveEpUrl] = useState<string>("");
  const [epFilter, setEpFilter] = useState("");

  // Watchlist (localStorage)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem("anichin_watchlist");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save Watchlist to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem("anichin_watchlist", JSON.stringify(watchlist));
    } catch (e) {
      console.error("Failed to save watchlist:", e);
    }
  }, [watchlist]);

  // Load Home List on Mount
  useEffect(() => {
    loadHomeData();
  }, []);

  // Handle Search Debounce
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  // Keydown Escape Listener to Close Player Overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPlaying) {
        setIsPlaying(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  const loadHomeData = async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      const data = await getHome();
      setHomeList(data);
    } catch (err: any) {
      setHomeError(err.message || "Gagal memuat rilis terbaru Anichin.");
    } finally {
      setHomeLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setActiveTab("search");
    setSearchLoading(true);
    try {
      const data = await searchAnime(searchQuery.trim());
      setSearchResults(data);
    } catch (err: any) {
      onShowToast(err.message || "Gagal melakukan pencarian.", "error");
    } finally {
      setSearchLoading(false);
    }
  };

  const openAnimeDetail = async (anime: AnimeItem, epUrl?: string) => {
    setSelectedAnime(anime);
    setDetailLoading(true);
    setAnimeDetail(null);
    const targetUrl = epUrl || anime.url;
    setActiveEpUrl(targetUrl);

    try {
      const detail = await getDetail(targetUrl);
      setAnimeDetail(detail);
      // Auto open player if stream url exists
      if (detail.url_stream) {
        setIsPlaying(true);
      }
      saveToWatchlist(anime, detail.episode);
    } catch (err: any) {
      onShowToast("Gagal memuat detail episode / video.", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const switchEpisode = async (ep: EpisodeItem) => {
    if (!selectedAnime) return;
    setDetailLoading(true);
    setActiveEpUrl(ep.url);
    try {
      const detail = await getDetail(ep.url);
      setAnimeDetail(detail);
      setIsPlaying(true);
      onShowToast(`Memutar Episode ${ep.episode} 🎬`, "success");
      saveToWatchlist(selectedAnime, ep.episode);
    } catch (err: any) {
      onShowToast("Gagal mengganti episode.", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const isInWatchlist = (url: string) => {
    return watchlist.some((item) => item.url === url);
  };

  const toggleWatchlist = (anime: AnimeItem) => {
    if (isInWatchlist(anime.url)) {
      setWatchlist(watchlist.filter((item) => item.url !== anime.url));
      onShowToast(`"${anime.judul}" dihapus dari riwayat.`, "info");
    } else {
      const newItem: WatchlistItem = {
        judul: anime.judul,
        url: anime.url,
        thumbnail: anime.thumbnail,
        updated_at: Date.now(),
      };
      setWatchlist([newItem, ...watchlist]);
      onShowToast(`"${anime.judul}" disimpan ke watchlist! ⭐`, "success");
    }
  };

  const saveToWatchlist = (anime: AnimeItem, epNumber?: string) => {
    setWatchlist((prev) => {
      const existing = prev.find((item) => item.url === anime.url);
      const updatedItem: WatchlistItem = {
        judul: anime.judul,
        url: anime.url,
        thumbnail: anime.thumbnail,
        last_episode: epNumber,
        updated_at: Date.now(),
      };
      if (existing) {
        return [updatedItem, ...prev.filter((item) => item.url !== anime.url)];
      } else {
        return [updatedItem, ...prev];
      }
    });
  };

  // Drag Scroll Handler for Horizontal Tabs
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

  const filteredEpisodes = animeDetail?.episodes.filter((ep) => {
    if (!epFilter.trim()) return true;
    return ep.episode.toLowerCase().includes(epFilter.toLowerCase());
  }) || [];

  return (
    <div className="space-y-6 text-white animate-fade-in font-sans">
      {/* ─── Hero Spotlight Banner ────────────────────────────────────────── */}
      <div className="relative rounded-3xl p-6 overflow-hidden border border-cyan-500/30 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-sky-950/60 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 tracking-wider">
                Anichin Streamer v1.0
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🐉 Donghua Sub Indo
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Anichin Donghua & Anime Streamer</span>
            </h2>
            <p className="text-white/60 text-xs max-w-xl leading-relaxed">
              Nonton Donghua (Anime China) Subtitle Indonesia favorit seperti Battle Through the Heavens, Perfect World, Soul Land, & Renegade Immortal secara gratis & cepat.
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full md:w-72 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari Judul Donghua / Anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:bg-white/15 transition-all shadow-inner"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-white/50 text-xs" />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setActiveTab("home"); }}
                  className="absolute right-3 top-2.5 text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-3">
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
          }}
          onMouseDown={handleMouseDownDrag}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 max-w-full cursor-grab active:cursor-grabbing select-none flex-nowrap"
        >
          <button
            onClick={() => setActiveTab("home")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === "home"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-105"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-play text-cyan-300" />
            <span>Terbaru (Rilis)</span>
          </button>

          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === "search"
                ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/30 scale-105"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-magnifying-glass text-sky-300" />
            <span>Pencarian ({searchResults.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === "watchlist"
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-105"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <i className="fa-solid fa-bookmark text-emerald-300" />
            <span>Watchlist ({watchlist.length})</span>
          </button>
        </div>
      </div>

      {/* ─── Content Grid ─────────────────────────────────────────────────── */}
      {activeTab === "home" ? (
        homeLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-3 space-y-3 animate-pulse border border-white/10">
                <div className="w-full h-48 bg-white/10 rounded-xl" />
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : homeError ? (
          <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-center space-y-3 my-4">
            <i className="fa-solid fa-triangle-exclamation text-rose-400 text-3xl" />
            <p className="text-sm font-bold text-rose-200">{homeError}</p>
            <button
              onClick={() => loadHomeData()}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs transition-all"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {homeList.map((anime, idx) => (
              <div
                key={idx}
                onClick={() => openAnimeDetail(anime)}
                className="glass-card rounded-2xl p-3 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer transition-all group flex flex-col justify-between space-y-2 relative overflow-hidden"
              >
                {/* Poster Image */}
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 shadow-md">
                  {anime.thumbnail ? (
                    <img
                      src={anime.thumbnail}
                      alt={anime.judul}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-3xl">
                      <i className="fa-solid fa-film" />
                    </div>
                  )}

                  {/* Play Overlay Hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                    <div className="w-12 h-12 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-lg font-bold shadow-lg transform group-hover:scale-110 transition-transform">
                      <i className="fa-solid fa-play ml-1" />
                    </div>
                  </div>

                  {/* Episode Badge */}
                  {anime.eps && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-cyan-600/90 text-white backdrop-blur-md shadow-md">
                      {anime.eps}
                    </span>
                  )}
                </div>

                {/* Title */}
                <div>
                  <h4 className="text-white font-bold text-xs line-clamp-2 group-hover:text-cyan-300 transition-colors">
                    {anime.judul}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === "search" ? (
        searchLoading ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-white/50">Mencari judul donghua / anime...</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="py-16 text-center space-y-3 glass-card rounded-3xl border border-white/10 my-4">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 text-2xl">
              <i className="fa-solid fa-magnifying-glass" />
            </div>
            <h3 className="text-white font-extrabold text-base">Cari Judul Anime</h3>
            <p className="text-white/50 text-xs max-w-sm mx-auto">
              Ketikkan judul Donghua di kotak pencarian di atas (contoh: Battle Through the Heavens, Perfect World, Soul Land).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {searchResults.map((anime, idx) => (
              <div
                key={idx}
                onClick={() => openAnimeDetail(anime)}
                className="glass-card rounded-2xl p-3 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer transition-all group flex flex-col justify-between space-y-2 relative overflow-hidden"
              >
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 shadow-md">
                  {anime.thumbnail ? (
                    <img
                      src={anime.thumbnail}
                      alt={anime.judul}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-3xl">
                      <i className="fa-solid fa-film" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-white font-bold text-xs line-clamp-2 group-hover:text-cyan-300 transition-colors">
                    {anime.judul}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )
      ) : watchlist.length === 0 ? (
        <div className="py-16 text-center space-y-3 glass-card rounded-3xl border border-white/10 my-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 text-2xl">
            <i className="fa-regular fa-bookmark" />
          </div>
          <h3 className="text-white font-extrabold text-base">Watchlist Kosong</h3>
          <p className="text-white/50 text-xs max-w-sm mx-auto">
            Simpan Donghua favorit Anda untuk ditonton kembali kapan saja dengan menekan tombol bookmark.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {watchlist.map((item, idx) => (
            <div
              key={idx}
              onClick={() => openAnimeDetail({ judul: item.judul, url: item.url, thumbnail: item.thumbnail })}
              className="glass-card rounded-2xl p-3 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 cursor-pointer transition-all group flex flex-col justify-between space-y-2 relative overflow-hidden"
            >
              <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 shadow-md">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.judul}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-3xl">
                    <i className="fa-solid fa-film" />
                  </div>
                )}
                {item.last_episode && (
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-950/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                    Ep: {item.last_episode}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWatchlist(watchlist.filter((w) => w.url !== item.url));
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
              <div>
                <h4 className="text-white font-bold text-xs line-clamp-1 group-hover:text-emerald-300 transition-colors">
                  {item.judul}
                </h4>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Detail & Streaming Video Modal / Fullscreen Player ───────────── */}
      {selectedAnime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="glass-card w-full max-w-4xl max-h-[92vh] rounded-3xl border border-white/20 overflow-hidden flex flex-col shadow-2xl relative">
            {/* Header Bar */}
            <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-cyan-500 text-slate-950 shadow-md flex-shrink-0">
                  DONGHUA STREAM
                </span>
                <h3 className="text-sm font-bold text-white line-clamp-1">
                  {animeDetail?.judul || selectedAnime.judul}
                </h3>
              </div>
              <button
                onClick={() => { setSelectedAnime(null); setIsPlaying(false); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Video Player / Detail Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 tab-scroll">
              {detailLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-white/60">Mengambil stream video & daftar episode...</p>
                </div>
              ) : (
                <>
                  {/* Video Stream iFrame Player */}
                  {animeDetail?.url_stream ? (
                    <div className="space-y-3">
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/20 shadow-2xl">
                        <iframe
                          src={animeDetail.url_stream}
                          title={animeDetail.judul}
                          className="w-full h-full border-0"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>

                      {/* Stream Controls & Fallback */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/5 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleWatchlist(selectedAnime)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                              isInWatchlist(selectedAnime.url)
                                ? "bg-emerald-500 text-slate-950"
                                : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                          >
                            <i className="fa-solid fa-bookmark" />
                            <span>{isInWatchlist(selectedAnime.url) ? "Tersimpan" : "+ Watchlist"}</span>
                          </button>

                          <a
                            href={animeDetail.url_stream}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square" />
                            <span>Buka Tab Baru</span>
                          </a>
                        </div>

                        {animeDetail.episode && (
                          <span className="text-xs font-mono text-cyan-300 font-bold bg-cyan-500/20 px-2.5 py-1 rounded-xl border border-cyan-500/30">
                            Episode: {animeDetail.episode}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 space-y-2">
                      <i className="fa-solid fa-circle-exclamation text-amber-400 text-2xl" />
                      <p className="text-xs text-white/70">Pemutar video iframe tidak ditemukan langsung.</p>
                      {selectedAnime.url && (
                        <a
                          href={selectedAnime.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-2 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                        >
                          Tonton Langsung di Anichin ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* Episodes List */}
                  {animeDetail?.episodes && animeDetail.episodes.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                          <i className="fa-solid fa-list-ol text-cyan-400" />
                          <span>Daftar Episode ({filteredEpisodes.length})</span>
                        </h4>

                        <input
                          type="text"
                          placeholder="Cari episode..."
                          value={epFilter}
                          onChange={(e) => setEpFilter(e.target.value)}
                          className="w-32 bg-white/5 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto tab-scroll pr-1">
                        {filteredEpisodes.map((ep, idx) => (
                          <button
                            key={idx}
                            onClick={() => switchEpisode(ep)}
                            className={`p-2.5 rounded-xl border text-left transition-all text-xs font-bold flex items-center justify-between group ${
                              activeEpUrl === ep.url
                                ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-md"
                                : "bg-white/5 border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/40 text-white"
                            }`}
                          >
                            <span className="line-clamp-1">Ep {ep.episode}</span>
                            <i className="fa-solid fa-play text-[10px] opacity-40 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
