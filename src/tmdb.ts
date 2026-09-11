import 'dotenv/config';
import axios from 'axios';
import type { MovieDetail, MovieItem } from './types';
import { scrapeMovieDetail as htmlScrapeDetail, scrapeMovieList as htmlScrapeList } from './scraper-html';

const TMDB_API_KEY = (process.env.TMDB_API_KEY || '').trim();
const TMDB_ACCESS_TOKEN = (process.env.TMDB_ACCESS_TOKEN || '').trim();
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

/** Bahasa yang dipakai untuk overview/judul (default Indonesia). */
const LANGUAGE = (process.env.TMDB_LANGUAGE || 'id-ID').trim();

/** Apakah kredensial API resmi TMDB tersedia? */
export function isTmdbConfigured(): boolean {
  return Boolean(TMDB_API_KEY || TMDB_ACCESS_TOKEN);
}

/** Parameter/kredensial auth untuk setiap request ke TMDB. */
function auth(): { params: Record<string, string | number>; headers: Record<string, string> } {
  if (TMDB_ACCESS_TOKEN) {
    return {
      params: {},
      headers: {
        Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
        Accept: 'application/json',
      },
    };
  }
  return { params: { api_key: TMDB_API_KEY }, headers: { Accept: 'application/json' } };
}

/** "2024-05-22" -> "22 Mei 2024" (fallback aman jika tanggal kosong). */
function formatDate(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(t));
  } catch {
    return iso;
  }
}

/** Runtime menit -> "2h 14m". */
function formatRuntime(mins?: number): string {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Ambil 4 digit tahun dari string tanggal apa pun. */
export function extractYear(value?: string): string {
  if (!value) return '';
  const m = value.match(/(19|20)\d{2}/);
  return m ? m[0] : '';
}

/**
 * Pilih trailer YouTube terbaik dari list video TMDB.
 * Prioritas: Trailer > Teaser > video YouTube apa pun, dengan bonus kalau site=YouTube.
 */
function pickTrailer(videos: Array<Record<string, unknown>> | undefined): string {
  if (!videos?.length) return '';
  const yt = videos.filter((v) => v.site === 'YouTube' && typeof v.key === 'string');
  if (!yt.length) return '';
  const byType = (type: string) => yt.find((v) => v.type === type);
  const chosen = byType('Trailer') || byType('Teaser') || byType('Clip') || yt[0];
  return String(chosen?.key || '');
}

const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
};

export async function scrapeMovieList(page = 1): Promise<MovieItem[]> {
  if (!isTmdbConfigured()) {
    console.log('⚠️  TMDB_API_KEY / TMDB_ACCESS_TOKEN kosong → fallback ke HTML scraper.');
    return htmlScrapeList(page);
  }

  try {
    const { params, headers } = auth();
    const res = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
      params: { ...params, language: LANGUAGE, page },
      headers,
      timeout: 20_000,
    });

    return (res.data.results ?? [])
      .filter((m: Record<string, unknown>) => m.poster_path)
      .map((m: Record<string, unknown>) => ({
        id: String(m.id),
        tmdbId: String(m.id),
        title: String(m.title || m.name || 'Untitled'),
        releaseDate: formatDate(String(m.release_date || m.first_air_date || '')),
        releaseDateIso: String(m.release_date || m.first_air_date || ''),
        url: `https://www.themoviedb.org/movie/${m.id}`,
        posterUrl: m.poster_path ? `${POSTER_BASE_URL}${m.poster_path}` : '',
        backdropUrl: m.backdrop_path ? `${BACKDROP_BASE_URL}${m.backdrop_path}` : undefined,
        description: String(m.overview || ''),
        ratingValue: Number(m.vote_average || 0),
        ratingCount: Number(m.vote_count || 0),
        genres: (m.genre_ids as number[] || []).map(id => GENRE_MAP[id]).filter(Boolean),
      }));
  } catch (err) {
    console.error('❌ Gagal mengambil daftar film dari TMDB API:', (err as Error).message);
    return [];
  }
}

export async function scrapeMovieDetail(movieUrl: string): Promise<Partial<MovieDetail>> {
  if (!isTmdbConfigured()) {
    return htmlScrapeDetail(movieUrl);
  }

  const match = movieUrl.match(/\/(?:movie|tv)\/(\d+)/);
  if (!match) return {};
  const movieId = match[1];

  try {
    const { params, headers } = auth();
    const res = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
      params: { ...params, language: LANGUAGE, append_to_response: 'videos,release_dates,credits' },
      headers,
      timeout: 20_000,
    });

    const data = res.data as Record<string, unknown>;
    const trailerKey = pickTrailer((data.videos as Record<string, unknown>)?.results as Array<Record<string, unknown>>);
    const cast = ((data.credits as Record<string, unknown>)?.cast as Array<Record<string, unknown>> || [])
      .slice(0, 6)
      .map((c) => String(c.name || ''))
      .filter(Boolean);

    return {
      description: String(data.overview || ''),
      ratingValue: Number(data.vote_average || 0),
      ratingCount: Number(data.vote_count || 0),
      genres: ((data.genres as Array<Record<string, unknown>>) || []).map((g) => String(g.name)),
      duration: formatRuntime(Number(data.runtime || 0)),
      trailerKey,
      trailerUrl: trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : undefined,
      backdropUrl: data.backdrop_path ? `${BACKDROP_BASE_URL}${data.backdrop_path}` : undefined,
      cast: cast.length ? cast : undefined,
      tmdbId: movieId,
    } as Partial<MovieDetail>;
  } catch (err) {
    console.error(`❌ Gagal mengambil detail ${movieUrl} dari TMDB API:`, (err as Error).message);
    return {};
  }
}

/** Peta genre resmi dari TMDB (id -> nama), di-cache sekali per proses. */
let genreMapCache: Record<number, string> | null = null;

export async function fetchGenreMap(): Promise<Record<number, string>> {
  if (genreMapCache) return genreMapCache;
  const base = { ...GENRE_MAP } as Record<number, string>;
  if (!isTmdbConfigured()) return base;
  try {
    const { params, headers } = auth();
    const res = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
      params: { ...params, language: 'en' },
      headers,
      timeout: 15_000,
    });
    for (const g of res.data?.genres ?? []) {
      if (g?.id && g?.name) base[Number(g.id)] = String(g.name);
    }
    genreMapCache = base;
  } catch (err) {
    console.warn('⚠️  Gagal ambil daftar genre TMDB:', (err as Error).message);
  }
  return genreMapCache ?? base;
}

/**
 * Ambil satu halaman daftar film dari endpoint TMDB apa pun
 * (movie/popular, movie/top_rated, movie/now_playing, movie/upcoming,
 *  discover/movie, trending/movie/week, dsb).
 */
export async function fetchTmdbList(
  endpoint: string,
  page = 1,
  extraParams: Record<string, string | number | boolean> = {},
  collection = 'popular',
): Promise<MovieDetail[]> {
  if (!isTmdbConfigured()) return [];
  try {
    const { params, headers } = auth();
    const res = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: { ...params, language: LANGUAGE, page, ...extraParams },
      headers,
      timeout: 20_000,
    });

    const map = await fetchGenreMap();
    const isTvEndpoint = endpoint.includes('/tv');
    return (res.data?.results ?? [])
      .filter((m: Record<string, unknown>) => m.poster_path && (m.title || m.name))
      .map((m: Record<string, unknown>) => {
        const isTv = isTvEndpoint || Boolean(m.first_air_date);
        return {
          id: String(m.id),
          tmdbId: String(m.id),
          title: String(m.title || m.name || 'Untitled'),
          releaseDate: formatDate(String(m.release_date || m.first_air_date || '')),
          releaseDateIso: String(m.release_date || m.first_air_date || ''),
          url: `https://www.themoviedb.org/${isTv ? 'tv' : 'movie'}/${m.id}`,
          posterUrl: `${POSTER_BASE_URL}${m.poster_path}`,
          backdropUrl: m.backdrop_path
            ? `${BACKDROP_BASE_URL}${String(m.backdrop_path)}`
            : undefined,
          description: String(m.overview || ''),
          ratingValue: Number(m.vote_average || 0),
          ratingCount: Number(m.vote_count || 0),
          genres: ((m.genre_ids as number[]) || []).map((id) => map[id]).filter(Boolean),
          collections: [collection],
          mediaType: (isTv ? 'tv' : 'movie') as 'movie' | 'tv',
        };
      });
  } catch (err) {
    console.warn(`⚠️  Gagal halaman ${page} dari ${endpoint}: ${(err as Error).message}`);
    return [];
  }
}

/** Pencarian real-time ke TMDB (dipakai bila film/series tidak ada di katalog lokal). */
export async function fetchTmdbSearch(query: string): Promise<MovieDetail[]> {
  if (!isTmdbConfigured()) return [];
  try {
    const listMovie = await fetchTmdbList('/search/movie', 1, { query, include_adult: false }, 'search');
    const listTv = await fetchTmdbList('/search/tv', 1, { query, include_adult: false }, 'search');
    return [...listMovie, ...listTv];
  } catch (err) {
    console.warn('⚠️  Pencarian TMDB gagal:', (err as Error).message);
    return [];
  }
}

/**
 * Ambil satu film lengkap (poster, judul, trailer, cast, runtime) berdasarkan
 * TMDB ID. Dipakai untuk "self-healing": kalau film belum ada di katalog lokal,
 * server menarik datanya langsung dari TMDB.
 */
export async function fetchMovieById(tmdbId: string): Promise<MovieDetail | null> {
  if (!isTmdbConfigured()) return null;
  try {
    const { params, headers } = auth();
    const res = await axios.get(`${TMDB_BASE_URL}/movie/${tmdbId}`, {
      params: { ...params, language: LANGUAGE, append_to_response: 'videos,credits' },
      headers,
      timeout: 20_000,
    });
    const data = res.data as Record<string, unknown>;
    if (!data || !data.id) return null;

    const trailerKey = pickTrailer((data.videos as Record<string, unknown>)?.results as Array<Record<string, unknown>>);
    const cast = ((data.credits as Record<string, unknown>)?.cast as Array<Record<string, unknown>> || [])
      .slice(0, 6)
      .map((c) => String(c.name || ''))
      .filter(Boolean);

    return {
      id: String(data.id),
      tmdbId: String(data.id),
      title: String(data.title || data.name || 'Untitled'),
      releaseDate: formatDate(String(data.release_date || '')),
      releaseDateIso: String(data.release_date || ''),
      url: `https://www.themoviedb.org/movie/${data.id}`,
      posterUrl: data.poster_path ? `${POSTER_BASE_URL}${String(data.poster_path)}` : '',
      backdropUrl: data.backdrop_path ? `${BACKDROP_BASE_URL}${String(data.backdrop_path)}` : undefined,
      description: String(data.overview || ''),
      ratingValue: Number(data.vote_average || 0),
      ratingCount: Number(data.vote_count || 0),
      genres: ((data.genres as Array<Record<string, unknown>>) || []).map((g) => String(g.name)),
      duration: formatRuntime(Number(data.runtime || 0)),
      trailerKey: trailerKey || undefined,
      trailerUrl: trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : undefined,
      cast: cast.length ? cast : undefined,
      collections: ['ondemand'],
    };
  } catch (err) {
    console.warn(`⚠️  Gagal ambil detail TMDB id=${tmdbId}:`, (err as Error).message);
    return null;
  }
}


/** Helper util: coba resolve sebagai film dulu, kalau gagal, baru serial TV. */
export async function fetchMediaById(tmdbId: string): Promise<MovieDetail | SeriesDetail | null> {
  const movie = await fetchMovieById(tmdbId);
  if (movie) return movie;
  return await fetchSeriesById(tmdbId);
}

export interface SeriesSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterUrl?: string;
  airDate?: string;
}

export interface SeriesEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  stillUrl?: string;
  runtime?: number;
  airDate?: string;
  ratingValue?: number;
}

export interface SeriesDetail extends MovieDetail {
  seasons: SeriesSeason[];
}

/**
 * Ambil detail serial TV lengkap (termasuk daftar season) dari TMDB.
 */
export async function fetchSeriesById(tmdbId: string): Promise<SeriesDetail | null> {
  if (!isTmdbConfigured()) return null;
  try {
    const { params, headers } = auth();
    const res = await axios.get(`${TMDB_BASE_URL}/tv/${tmdbId}`, {
      params: { ...params, language: LANGUAGE, append_to_response: 'videos,credits' },
      headers,
      timeout: 20_000,
    });
    const data = res.data as Record<string, unknown>;
    if (!data || !data.id) return null;

    const trailerKey = pickTrailer((data.videos as Record<string, unknown>)?.results as Array<Record<string, unknown>>);
    const cast = ((data.credits as Record<string, unknown>)?.cast as Array<Record<string, unknown>> || [])
      .slice(0, 6)
      .map((c) => String(c.name || ''))
      .filter(Boolean);

    const seasons = ((data.seasons as Array<Record<string, unknown>>) || [])
      .filter((s) => Number(s.season_number) >= 1)
      .map((s) => ({
        seasonNumber: Number(s.season_number),
        name: String(s.name || `Season ${s.season_number}`),
        episodeCount: Number(s.episode_count || 0),
        posterUrl: s.poster_path ? `${POSTER_BASE_URL}${String(s.poster_path)}` : undefined,
        airDate: s.air_date ? String(s.air_date) : undefined,
      }));

    const episodeTotal = Number(data.number_of_episodes || 0);
    const lastEp = seasons.length ? seasons[seasons.length - 1].episodeCount : 0;

    return {
      id: String(data.id),
      tmdbId: String(data.id),
      mediaType: 'tv',
      seasonsCount: seasons.length,
      title: String(data.name || data.title || 'Untitled'),
      releaseDate: formatDate(String(data.first_air_date || '')),
      releaseDateIso: String(data.first_air_date || ''),
      url: `https://www.themoviedb.org/tv/${data.id}`,
      posterUrl: data.poster_path ? `${POSTER_BASE_URL}${String(data.poster_path)}` : '',
      backdropUrl: data.backdrop_path ? `${BACKDROP_BASE_URL}${String(data.backdrop_path)}` : undefined,
      description: String(data.overview || ''),
      ratingValue: Number(data.vote_average || 0),
      ratingCount: Number(data.vote_count || 0),
      genres: ((data.genres as Array<Record<string, unknown>>) || []).map((g) => String(g.name)),
      duration: episodeTotal ? `${episodeTotal} episode` : lastEp ? `Season terakhir: ${lastEp} episode` : undefined,
      trailerKey: trailerKey || undefined,
      trailerUrl: trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : undefined,
      cast: cast.length ? cast : undefined,
      collections: ['series'],
      seasons,
    };
  } catch (err) {
    console.warn(`⚠️  Gagal ambil detail serial TMDB id=${tmdbId}:`, (err as Error).message);
    return null;
  }
}

/**
 * Ambil daftar episode dari satu season serial TV.
 */
export async function fetchSeriesEpisodes(
  tmdbId: string,
  seasonNumber: number,
): Promise<SeriesEpisode[]> {
  if (!isTmdbConfigured()) return [];
  try {
    const { params, headers } = auth();
    const res = await axios.get(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}`, {
      params: { ...params, language: LANGUAGE },
      headers,
      timeout: 20_000,
    });
    const episodes = (res.data?.episodes as Array<Record<string, unknown>>) || [];
    return episodes.map((e) => ({
      seasonNumber,
      episodeNumber: Number(e.episode_number || 0),
      name: String(e.name || `Episode ${e.episode_number}`),
      overview: String(e.overview || ''),
      stillUrl: e.still_path ? `${POSTER_BASE_URL}${String(e.still_path)}` : undefined,
      runtime: e.runtime ? Number(e.runtime) : undefined,
      airDate: e.air_date ? String(e.air_date) : undefined,
      ratingValue: e.vote_average ? Number(e.vote_average) : undefined,
    }));
  } catch (err) {
    console.warn(`⚠️  Gagal ambil episode TMDB id=${tmdbId} S${seasonNumber}:`, (err as Error).message);
    return [];
  }
}

