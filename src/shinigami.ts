/**
 * Shinigami Manga Reader API Service & Types
 * Base API: https://api.shngm.io/v1
 * Public Web: https://f.shinigami.asia
 */

const CONFIG = {
  BASE_URL: "https://api.shngm.io/v1",
  HEADERS: {
    "Accept": "application/json",
    "Content-Type": "application/json",
  },
};

export interface MangaItem {
  manga_id: string;
  id?: string;
  title: string;
  description?: string;
  alternative_title?: string;
  release_year?: string;
  status?: number; // 1 = Ongoing, 2 = Completed
  cover_image_url?: string;
  cover_portrait_url?: string;
  view_count?: number;
  user_rate?: number;
  latest_chapter_id?: string;
  latest_chapter_number?: number;
  latest_chapter_time?: string;
  country_id?: string;
  bookmark_count?: number;
  rank?: number;
  is_recommended?: boolean;
  taxonomy?: {
    Artist?: Array<{ taxonomy_id: number; slug: string; name: string }>;
    Author?: Array<{ taxonomy_id: number; slug: string; name: string }>;
    Category?: Array<{ taxonomy_id: number; slug: string; name: string }>;
    Format?: Array<{ taxonomy_id: number; slug: string; name: string }>;
    Genre?: Array<{ taxonomy_id: number; slug: string; name: string }>;
    Type?: Array<{ taxonomy_id: number; slug: string; name: string }>;
  };
  created_at?: string;
  updated_at?: string;
}

export interface ChapterItem {
  chapter_id: string;
  manga_id: string;
  chapter_title?: string;
  chapter_number: number;
  thumbnail_image_url?: string;
  view_count?: number;
  release_date?: string;
}

export interface ReadingChapterData {
  chapter_id: string;
  manga_id: string;
  chapter_number: number;
  chapter_title?: string;
  base_url?: string;
  base_url_low?: string;
  thumbnail_image_url?: string;
  images: string[];
  prev_chapter_id?: string | null;
  prev_chapter_number?: number | null;
  next_chapter_id?: string | null;
  next_chapter_number?: number | null;
  release_date?: string;
}

export interface ApiResponse<T> {
  retcode: number;
  message: string;
  meta?: {
    page?: number;
    page_size?: number;
    total_page?: number;
    total_record?: number;
    manga_id?: string;
  } | null;
  data: T | null;
}

export const shinigami = {
  _request: async <T = any>(endpoint: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> => {
    try {
      const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, String(params[key]));
        }
      });

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: CONFIG.HEADERS,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error(`[Shinigami API Error] ${endpoint}:`, error.message);
      return {
        retcode: -1,
        message: error.message || "Gagal menghubungkan ke server Shinigami.",
        meta: null,
        data: null,
      };
    }
  },

  /**
   * Get Top Ranked Manga/Manhwa/Manhua
   * @param filter 'daily' | 'weekly' | 'all_time'
   */
  getTop: async (filter: "daily" | "weekly" | "all_time" = "daily", page = 1, pageSize = 12) => {
    return await shinigami._request<MangaItem[]>("/manga/top", { filter, page, page_size: pageSize });
  },

  /**
   * Get Recommended Manga List
   * @param format 'manhwa' | 'manga' | 'manhua'
   */
  getRecommended: async (format: "manhwa" | "manga" | "manhua" = "manhwa", page = 1, pageSize = 12) => {
    return await shinigami._request<MangaItem[]>("/manga/list", {
      format,
      page,
      page_size: pageSize,
      is_recommended: "true",
      sort: "latest",
      sort_order: "desc",
    });
  },

  /**
   * Discover latest manga entries
   */
  discover: async (page = 1, pageSize = 24) => {
    return await shinigami._request<MangaItem[]>("/manga/list", {
      page,
      page_size: pageSize,
      genre_include_mode: "or",
      genre_exclude_mode: "or",
      sort: "latest",
      sort_order: "desc",
    });
  },

  /**
   * Search manga by query string
   */
  search: async (query: string, page = 1, pageSize = 12) => {
    return await shinigami._request<MangaItem[]>("/manga/list", { q: query, page, page_size: pageSize });
  },

  /**
   * Get manga detail information
   */
  detail: async (mangaId: string) => {
    return await shinigami._request<MangaItem>(`/manga/detail/${mangaId}`);
  },

  /**
   * Get chapter list of a manga (fetches all pages)
   */
  chapter: async (mangaId: string, sortOrder: "desc" | "asc" = "desc") => {
    const fetchPageSize = 50;
    const firstPage = await shinigami._request<ChapterItem[]>(`/chapter/${mangaId}/list`, {
      page: 1,
      page_size: fetchPageSize,
      sort_by: "chapter_number",
      sort_order: sortOrder,
    });

    if (firstPage.retcode !== 0 || !firstPage.data) return firstPage;

    let allChapters = [...firstPage.data];
    const totalPages = firstPage.meta?.total_page || 1;

    if (totalPages > 1) {
      const promises = [];
      for (let i = 2; i <= totalPages; i++) {
        promises.push(
          shinigami._request<ChapterItem[]>(`/chapter/${mangaId}/list`, {
            page: i,
            page_size: fetchPageSize,
            sort_by: "chapter_number",
            sort_order: sortOrder,
          })
        );
      }
      const subsequentPages = await Promise.all(promises);
      subsequentPages.forEach((res) => {
        if (res.retcode === 0 && res.data) {
          allChapters.push(...res.data);
        }
      });
    }

    return {
      retcode: 0,
      message: "success",
      meta: { manga_id: mangaId, total_page: totalPages, total_record: allChapters.length },
      data: allChapters,
    };
  },

  /**
   * Fetch chapter reading pages & full image URLs
   */
  reading: async (chapterId: string): Promise<ApiResponse<ReadingChapterData>> => {
    const response = await shinigami._request<any>(`/chapter/detail/${chapterId}`);

    if (response.retcode === 0 && response.data) {
      const rawData = response.data;
      const baseUrl = rawData.base_url || "https://assets.shngm.id";
      const chapterObj = rawData.chapter || {};
      const path = chapterObj.path || "";
      const rawImages: string[] = chapterObj.data || [];
      const fullImageUrls = rawImages.map((img) => `${baseUrl}${path}${img}`);

      const resultData: ReadingChapterData = {
        chapter_id: rawData.chapter_id || chapterId,
        manga_id: rawData.manga_id,
        chapter_number: rawData.chapter_number,
        chapter_title: rawData.chapter_title,
        base_url: baseUrl,
        base_url_low: rawData.base_url_low,
        thumbnail_image_url: rawData.thumbnail_image_url,
        images: fullImageUrls,
        prev_chapter_id: rawData.prev_chapter_id || null,
        prev_chapter_number: rawData.prev_chapter_number || null,
        next_chapter_id: rawData.next_chapter_id || null,
        next_chapter_number: rawData.next_chapter_number || null,
        release_date: rawData.release_date,
      };

      return {
        retcode: 0,
        message: "success",
        meta: response.meta,
        data: resultData,
      };
    }

    return response;
  },
};
