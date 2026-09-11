import 'dotenv/config';
import type { MovieItem, MovieDetail, ScrapeOptions } from './types';
import { sleep } from './utils';
import {
  scrapeMovieList as fetchList,
  scrapeMovieDetail as fetchDetail,
} from './tmdb';

export async function scrapeMovieList(page = 1): Promise<MovieItem[]> {
  return fetchList(page);
}

export async function scrapeMovieDetail(movieUrl: string): Promise<Partial<MovieDetail>> {
  return fetchDetail(movieUrl);
}

export async function scrapeMovies(options: ScrapeOptions = {}): Promise<MovieDetail[]> {
  const { pageCount = 1, fetchDetails = false } = options;
  const all: MovieItem[] = [];

  for (let page = 1; page <= pageCount; page++) {
    console.log(`📄 Mengambil halaman ke-${page}...`);
    try {
      const items = await scrapeMovieList(page);
      console.log(`   ↳ ditemukan ${items.length} film`);
      all.push(...items);
    } catch (error) {
      console.error(`   ✗ Halaman ${page} gagal: ${(error as Error).message}`);
    }
    if (page < pageCount) await sleep(300);
  }

  // Hilangkan duplikat berdasarkan URL
  const unique = Array.from(new Map(all.map((m) => [m.url, m])).values());
  console.log(`\n🎬 Total unik: ${unique.length} film`);

  if (!fetchDetails) {
    return unique.map((m) => ({ ...m }));
  }

  console.log(`\n🔍 Mengambil detail untuk ${unique.length} film...`);
  const results: MovieDetail[] = [];
  for (let i = 0; i < unique.length; i++) {
    const movie = unique[i] as MovieItem;
    process.stdout.write(`   [${i + 1}/${unique.length}] ${movie.title}\r`);
    const detail = await scrapeMovieDetail(movie.url);
    results.push({ ...movie, ...detail });
    await sleep(250);
  }
  console.log('');
  return results;
}