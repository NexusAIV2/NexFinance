export interface AnimeItem {
  judul: string;
  url: string;
  thumbnail: string;
  eps?: string;
}

export interface EpisodeItem {
  episode: string;
  url: string;
}

export interface AnimeDetail {
  judul: string;
  thumbnail: string;
  episode: string;
  url_stream: string;
  episodes: EpisodeItem[];
}

const BASE_URL = "https://anichin.ro";

// Fetch helper with fallback CORS handling
async function fetchHtml(targetUrl: string): Promise<string> {
  const attempts = [
    // Attempt 1: Vite proxy if target starts with BASE_URL
    targetUrl.replace(BASE_URL, "/anichin-proxy"),
    // Attempt 2: Direct fetch
    targetUrl,
    // Attempt 3: Public CORS proxy (allorigins)
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    // Attempt 4: Public CORS proxy (corsproxy)
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (res.ok) {
        const html = await res.text();
        if (html && html.includes("<html")) {
          return html;
        }
      }
    } catch {
      // try next fallback
    }
  }

  throw new Error("Gagal mengakses data Anichin.ro.");
}

/**
 * Mengambil data dari homepage anichin.ro
 */
export async function getHome(): Promise<AnimeItem[]> {
  const html = await fetchHtml(BASE_URL + "/");
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const results: AnimeItem[] = [];

  const elements = doc.querySelectorAll(".listupd .bs, .utao .bs, article.bs");
  elements.forEach((el) => {
    const linkElem = el.querySelector("a");
    if (!linkElem) return;

    let url = linkElem.getAttribute("href") || "";
    if (url.startsWith("/")) url = BASE_URL + url;

    const judul =
      linkElem.getAttribute("title") ||
      el.querySelector(".tt h2")?.textContent?.trim() ||
      el.querySelector(".tt")?.textContent?.trim() ||
      "";

    const img = el.querySelector("img");
    const thumbnail =
      img?.getAttribute("src") ||
      img?.getAttribute("data-src") ||
      img?.getAttribute("lazy-src") ||
      "";

    const eps =
      el.querySelector(".epx")?.textContent?.trim() ||
      el.querySelector(".bt .ep")?.textContent?.trim() ||
      "";

    if (url && judul) {
      results.push({ thumbnail, url, judul, eps });
    }
  });

  return results;
}

/**
 * Mencari anime berdasarkan query
 */
export async function searchAnime(query: string): Promise<AnimeItem[]> {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await fetchHtml(searchUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const results: AnimeItem[] = [];

  const elements = doc.querySelectorAll(".listupd .bs, .bs, article.bs");
  elements.forEach((el) => {
    const linkElem = el.querySelector("a");
    if (!linkElem) return;

    let url = linkElem.getAttribute("href") || "";
    if (url.startsWith("/")) url = BASE_URL + url;

    const judul =
      linkElem.getAttribute("title") ||
      el.querySelector(".tt h2")?.textContent?.trim() ||
      el.querySelector(".tt")?.textContent?.trim() ||
      "";

    const img = el.querySelector("img");
    const thumbnail =
      img?.getAttribute("src") ||
      img?.getAttribute("data-src") ||
      img?.getAttribute("lazy-src") ||
      "";

    const eps =
      el.querySelector(".epx")?.textContent?.trim() ||
      el.querySelector(".bt .ep")?.textContent?.trim() ||
      "";

    if (url && judul) {
      results.push({ thumbnail, url, judul, eps });
    }
  });

  return results;
}

/**
 * Mengambil detail dari URL episode / anime anichin
 */
export async function getDetail(url: string): Promise<AnimeDetail> {
  const fullUrl = url.startsWith("/") ? BASE_URL + url : url;
  const html = await fetchHtml(fullUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const judul =
    doc.querySelector("h1.entry-title")?.textContent?.trim() ||
    doc.title ||
    "Anime / Donghua";

  const img = doc.querySelector(".thumb img, .poster img, .single-info img");
  const ogImg = doc.querySelector('meta[property="og:image"]');
  const thumbnail =
    img?.getAttribute("src") ||
    img?.getAttribute("data-src") ||
    ogImg?.getAttribute("content") ||
    "";

  let episode = "";
  const epMatch =
    judul.match(/Episode\s+(\d+(?:\.\d+)?)/i) ||
    judul.match(/Ep\s+(\d+(?:\.\d+)?)/i);
  if (epMatch) {
    episode = epMatch[1];
  } else {
    const rawEp = doc.querySelector(".epx")?.textContent?.trim() || "";
    const numMatch = rawEp.match(/\d+/);
    episode = numMatch ? numMatch[0] : "Movie / Special";
  }

  let url_stream = "";

  // Check iframe tags
  const iframes = doc.querySelectorAll("iframe");
  iframes.forEach((ifr) => {
    const src = ifr.getAttribute("src") || ifr.getAttribute("data-src");
    if (src && !url_stream) {
      if (
        src.includes("ok.ru") ||
        src.includes("embed") ||
        src.includes("player") ||
        src.includes("http") ||
        src.includes("//")
      ) {
        url_stream = src.startsWith("//") ? "https:" + src : src;
      }
    }
  });

  // Check select/option elements jika ada mirror server
  if (!url_stream) {
    const options = doc.querySelectorAll("select option, .select-mirror option, select.mirror option");
    options.forEach((opt) => {
      const val = opt.getAttribute("value");
      if (val && !url_stream && (val.startsWith("http") || val.includes("embed") || val.includes("//"))) {
        url_stream = val.startsWith("//") ? "https:" + val : val;
      }
    });
  }

  if (!url_stream && iframes.length > 0) {
    const firstSrc = iframes[0].getAttribute("src") || iframes[0].getAttribute("data-src") || "";
    url_stream = firstSrc.startsWith("//") ? "https:" + firstSrc : firstSrc;
  }

  const episodes: EpisodeItem[] = [];
  const seenUrls = new Set<string>();

  const epElements = doc.querySelectorAll(
    ".episodes-ul a, .block_area-content .ep-item, .eplister li a, .episodelist li a, .eplister a"
  );
  epElements.forEach((el) => {
    let epUrl = el.getAttribute("href");
    if (!epUrl) return;
    if (epUrl.startsWith("/")) epUrl = BASE_URL + epUrl;

    if (seenUrls.has(epUrl)) return;
    seenUrls.add(epUrl);

    let epNum =
      el.getAttribute("data-number") ||
      el.querySelector(".order, .epl-num")?.textContent?.trim() ||
      el.textContent?.trim() ||
      "";

    epNum = epNum.replace(/\s+/g, " ").trim();

    episodes.push({
      episode: epNum,
      url: epUrl,
    });
  });

  return {
    url_stream,
    thumbnail,
    judul,
    episode,
    episodes,
  };
}
