import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fetchTmdbList } from './tmdb';
import type { MovieDetail } from './types';

export interface SyncSource {
  label: string;
  endpoint: string;
  pages: number;
  params?: Record<string, string | number>;
  collection: string;
}

export interface SyncStats {
  total: number;
  added: number;
  updated: number;
  fetched: number;
  finishedAt: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sumber "cepat" — dipakai auto-sync berkala & tombol refresh (± 60-100 film). */
export const QUICK_SOURCES: SyncSource[] = [
  { label: 'Now Playing', endpoint: '/movie/now_playing', pages: 2, collection: 'now_playing' },
  { label: 'Upcoming', endpoint: '/movie/upcoming', pages: 2, collection: 'upcoming' },
  { label: 'Popular', endpoint: '/movie/popular', pages: 2, collection: 'popular' },
  { label: 'Film Indonesia', endpoint: '/discover/movie', pages: 2, params: { with_original_language: 'id', sort_by: 'popularity.desc' }, collection: 'popular' },
  { label: 'Trending Minggu Ini', endpoint: '/trending/movie/week', pages: 2, collection: 'popular' },
  { label: 'Serial TV Trending', endpoint: '/trending/tv/week', pages: 2, collection: 'popular' },
];

/** Sumber lengkap — dipakai CLI `npm run sync` untuk memperbesar katalog. */
export const FULL_SOURCES: SyncSource[] = [
  { label: 'Popular', endpoint: '/movie/popular', pages: 200, collection: 'popular' },
  { label: 'Top Rated', endpoint: '/movie/top_rated', pages: 150, collection: 'top_rated' },
  { label: 'Now Playing', endpoint: '/movie/now_playing', pages: 50, collection: 'now_playing' },
  { label: 'Upcoming', endpoint: '/movie/upcoming', pages: 30, collection: 'upcoming' },
  { label: 'Serial TV Top', endpoint: '/tv/popular', pages: 150, collection: 'popular' },
  { label: 'Drakor', endpoint: '/discover/tv', pages: 100, params: { with_original_language: 'ko', sort_by: 'popularity.desc' }, collection: 'drakor' },
  { label: 'Anime TV', endpoint: '/discover/tv', pages: 100, params: { with_original_language: 'ja', with_genres: 16, sort_by: 'popularity.desc' }, collection: 'anime' },
  { label: 'Film Indonesia', endpoint: '/discover/movie', pages: 100, params: { with_original_language: 'id', sort_by: 'popularity.desc' }, collection: 'popular' },
  { label: 'Anime & Animasi', endpoint: '/discover/movie', pages: 100, params: { with_genres: 16, sort_by: 'popularity.desc' }, collection: 'anime' },
  { label: 'Horror', endpoint: '/discover/movie', pages: 100, params: { with_genres: 27, sort_by: 'popularity.desc' }, collection: 'horror' },
  { label: 'Action', endpoint: '/discover/movie', pages: 100, params: { with_genres: 28, sort_by: 'popularity.desc' }, collection: 'action' },
  { label: 'Sci-Fi', endpoint: '/discover/movie', pages: 100, params: { with_genres: 878, sort_by: 'popularity.desc' }, collection: 'scifi' },
  { label: 'Romance', endpoint: '/discover/movie', pages: 100, params: { with_genres: 10749, sort_by: 'popularity.desc' }, collection: 'romance' },
  { label: 'Comedy', endpoint: '/discover/movie', pages: 100, params: { with_genres: 35, sort_by: 'popularity.desc' }, collection: 'comedy' },
  { label: 'Drama', endpoint: '/discover/movie', pages: 100, params: { with_genres: 18, sort_by: 'popularity.desc' }, collection: 'drama' },
  { label: 'Thriller', endpoint: '/discover/movie', pages: 100, params: { with_genres: 53, sort_by: 'popularity.desc' }, collection: 'thriller' },
  { label: 'Crime', endpoint: '/discover/movie', pages: 100, params: { with_genres: 80, sort_by: 'popularity.desc' }, collection: 'crime' },
  { label: 'Adventure', endpoint: '/discover/movie', pages: 100, params: { with_genres: 12, sort_by: 'popularity.desc' }, collection: 'adventure' },
  { label: 'Fantasy', endpoint: '/discover/movie', pages: 100, params: { with_genres: 14, sort_by: 'popularity.desc' }, collection: 'fantasy' },
  { label: 'Mystery', endpoint: '/discover/movie', pages: 100, params: { with_genres: 9648, sort_by: 'popularity.desc' }, collection: 'mystery' },
  { label: 'War', endpoint: '/discover/movie', pages: 60, params: { with_genres: 10752, sort_by: 'popularity.desc' }, collection: 'war' },
  { label: 'Western', endpoint: '/discover/movie', pages: 60, params: { with_genres: 37, sort_by: 'popularity.desc' }, collection: 'western' },
  { label: 'Documentary', endpoint: '/discover/movie', pages: 60, params: { with_genres: 99, sort_by: 'popularity.desc' }, collection: 'documentary' },
  { label: 'Family', endpoint: '/discover/movie', pages: 60, params: { with_genres: 10751, sort_by: 'popularity.desc' }, collection: 'family' },
  { label: 'Music', endpoint: '/discover/movie', pages: 40, params: { with_genres: 10402, sort_by: 'popularity.desc' }, collection: 'music' },
  { label: 'History', endpoint: '/discover/movie', pages: 60, params: { with_genres: 36, sort_by: 'popularity.desc' }, collection: 'history' },
  { label: 'FilmBox Office Terlaris', endpoint: '/discover/movie', pages: 100, params: { sort_by: 'revenue.desc' }, collection: 'popular' },
  { label: 'Rating Tertinggi (1000+ vote)', endpoint: '/discover/movie', pages: 100, params: { sort_by: 'vote_average.desc', 'vote_count.gte': 500 }, collection: 'top_rated' },
  // ---- Bahasa / regional ----
  { label: 'Film Hindi (Bollywood)', endpoint: '/discover/movie', pages: 100, params: { with_original_language: 'hi', sort_by: 'popularity.desc' }, collection: 'bollywood' },
  { label: 'Film Mandarin', endpoint: '/discover/movie', pages: 100, params: { with_original_language: 'zh', sort_by: 'popularity.desc' }, collection: 'cdrama' },
  { label: 'Film Thailand', endpoint: '/discover/movie', pages: 80, params: { with_original_language: 'th', sort_by: 'popularity.desc' }, collection: 'thai' },
  { label: 'Film Korea', endpoint: '/discover/movie', pages: 100, params: { with_original_language: 'ko', sort_by: 'popularity.desc' }, collection: 'drakor' },
  { label: 'Film Jepang', endpoint: '/discover/movie', pages: 100, params: { with_original_language: 'ja', sort_by: 'popularity.desc' }, collection: 'anime' },
  { label: 'Film Inggris', endpoint: '/discover/movie', pages: 100, params: { with_original_language: 'en', sort_by: 'popularity.desc' }, collection: 'popular' },
  { label: 'Film Prancis', endpoint: '/discover/movie', pages: 60, params: { with_original_language: 'fr', sort_by: 'popularity.desc' }, collection: 'european' },
  { label: 'Film Spanyol', endpoint: '/discover/movie', pages: 60, params: { with_original_language: 'es', sort_by: 'popularity.desc' }, collection: 'european' },
  { label: 'Film Jerman', endpoint: '/discover/movie', pages: 50, params: { with_original_language: 'de', sort_by: 'popularity.desc' }, collection: 'european' },
  { label: 'Film Italia', endpoint: '/discover/movie', pages: 50, params: { with_original_language: 'it', sort_by: 'popularity.desc' }, collection: 'european' },
  { label: 'Film India Regional', endpoint: '/discover/movie', pages: 80, params: { with_original_language: 'ta', sort_by: 'popularity.desc' }, collection: 'bollywood' },
  { label: 'Film Turki', endpoint: '/discover/movie', pages: 60, params: { with_original_language: 'tr', sort_by: 'popularity.desc' }, collection: 'european' },
  { label: 'Film Rusia', endpoint: '/discover/movie', pages: 50, params: { with_original_language: 'ru', sort_by: 'popularity.desc' }, collection: 'european' },
  // ---- Serial TV ----
  { label: 'Serial Trending', endpoint: '/tv/top_rated', pages: 100, collection: 'series' },
  { label: 'Serial Now Airing', endpoint: '/tv/on_the_air', pages: 60, collection: 'series' },
  { label: 'Anime Serial (semua)', endpoint: '/discover/tv', pages: 100, params: { with_genres: 16, sort_by: 'vote_average.desc', 'vote_count.gte': 100 }, collection: 'anime' },
  { label: 'Variety/Reality Show', endpoint: '/discover/tv', pages: 60, params: { with_genres: 10764, sort_by: 'popularity.desc' }, collection: 'series' },
];

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * Gabungkan data baru ke record lama TANPA menghapus field kaya
 * (duration / trailer / cast) yang sudah ada sebelumnya.
 */
function mergeRecord(target: MovieDetail, incoming: MovieDetail): number {
  let changed = 0;
  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'collections') continue;
    if (!isEmpty(value) && JSON.stringify(target[key as keyof MovieDetail]) !== JSON.stringify(value)) {
      (target as unknown as Record<string, unknown>)[key] = value;
      changed = 1;
    }
  }
  const before = (target.collections ?? []).length;
  target.collections = Array.from(
    new Set([...(target.collections ?? []), ...(incoming.collections ?? [])]),
  );
  if (target.collections.length !== before) changed = 1;
  return changed;
}

/**
 * Mesin sinkronisasi katalog: ambil daftar film dari beberapa endpoint TMDB,
 * merge (bukan replace!) ke output/movies.json, lalu simpan.
 */
export async function syncCatalog(
  sources: SyncSource[],
  dataFile: string,
  opts: { verbose?: boolean } = {},
): Promise<SyncStats> {
  const verbose = opts.verbose ?? true;
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8');
  const existing = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as MovieDetail[];
  const index = new Map<string, MovieDetail>(existing.map((m) => [String(m.id), m]));

  let added = 0;
  let updated = 0;
  let fetched = 0;

  for (const src of sources) {
    let srcCount = 0;
    for (let page = 1; page <= src.pages; page++) {
      const items = await fetchTmdbList(src.endpoint, page, (src.params ?? {}) as Record<string, string | number>, src.collection);
      if (items.length === 0) break;
      fetched += items.length;
      for (const item of items) {
        if (!item.id || !item.title || !item.posterUrl) continue;
        const cur = index.get(String(item.id));
        if (cur) {
          updated += mergeRecord(cur, item);
        } else {
          index.set(String(item.id), item);
          existing.push(item);
          added++;
        }
      }
      srcCount += items.length;
      await sleep(25);
    }
    
    // Tulis bertahap setiap kategori agar data tidak hilang kalau terhenti
    const unique = Array.from(index.values());
    fs.writeFileSync(dataFile, JSON.stringify(unique), 'utf-8');
    
    if (verbose) console.log(`   ✓ [${src.label}] ${srcCount} hasil diproses`);
  }

  // tulis ulang file (sudah ter-dedup via index map)
  const unique = Array.from(index.values());
  fs.writeFileSync(dataFile, JSON.stringify(unique), 'utf-8');

  const stats: SyncStats = { total: unique.length, added, updated, fetched, finishedAt: new Date().toISOString() };
  if (verbose) console.log(`📊 Sinkron selesai → total ${stats.total} film (+${added} baru, ~${updated} diperbarui)`);
  return stats;
}

if (require.main === module) {
  const dataFile = path.resolve(__dirname, '../output/movies.json');
  console.log('🔄 Memulai sinkronisasi katalog TMDB lengkap (Termasuk Film Indonesia)...');
  syncCatalog(FULL_SOURCES, dataFile, { verbose: true }).then(() => {
    console.log('✅ Selesai.');
  }).catch((err) => {
    console.error('❌ Terjadi kesalahan saat sinkronisasi:', err);
  });
}
