import axios from 'axios';
import * as cheerio from 'cheerio';
import type { MovieItem, MovieDetail, ScrapeOptions } from './types';
import { sleep } from './utils';

const BASE_URL = 'https://www.themoviedb.org';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Ambil daftar film dari satu halaman listing TMDB.
 * @param page Nomor halaman (mulai dari 1)
 */
export async function scrapeMovieList(page = 1): Promise<MovieItem[]> {
  const url = `${BASE_URL}/movie?page=${page}`;
  const response = await axios.get(url, { headers: HEADERS, timeout: 20000 });
  const $ = cheerio.load(response.data);
  const movies: MovieItem[] = [];

  // Setiap kartu film memiliki atribut data-object-id
  $('[data-object-id]').each((_, element) => {
    const el = $(element);
    const id = el.attr('data-object-id') ?? '';

    const titleEl = el.find('h2').first();
    const title = titleEl.text().trim();
    const href = titleEl.closest('a').attr('href') ?? '';

    // Lewati elemen non-film (mis. menu dropdown)
    if (!title || !href.startsWith('/movie/')) return;

    const releaseDate = el.find('.release_date').text().trim();
    const img = el.find('img').first();
    const posterUrl = img.attr('src') ?? img.attr('data-src') ?? '';

    movies.push({
      id,
      title,
      releaseDate,
      url: `${BASE_URL}${href}`,
      posterUrl,
    });
  });

  return movies;
}

/**
 * Ambil detail lengkap sebuah film (sinopsis, rating, genre) dari halaman
 * detail-nya. Data diambil dari blok JSON-LD (schema.org/Movie) bila tersedia.
 */
export async function scrapeMovieDetail(movieUrl: string): Promise<Partial<MovieDetail>> {
  try {
    const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(response.data);
    const detail: Partial<MovieDetail> = {};

    // 1. Baca JSON-LD (paling stabil & terstruktur)
    const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
    let jsonLd: Record<string, unknown> | null = null;
    for (const el of jsonLdScripts) {
      const raw = $(el).html() ?? '';
      // TMDB membungkus JSON-LD dengan komentar CDATA (/* <![CDATA[ */ ... /* ]]> */)
      // jadi kita ambil substring objek JSON-nya saja.
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end <= start) continue;
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
        if (parsed['@type'] === 'Movie') {
          jsonLd = parsed;
          break;
        }
      } catch {
        /* abaikan JSON-LD yang tidak valid */
      }
    }

    if (jsonLd) {
      detail.description = (jsonLd.description as string) ?? '';
      const agg = jsonLd.aggregateRating as Record<string, unknown> | undefined;
      if (agg) {
        detail.ratingValue = Number(agg.ratingValue) || 0;
        detail.ratingCount = Number(agg.ratingCount) || 0;
      }
      if (Array.isArray(jsonLd.genre)) {
        detail.genres = (jsonLd.genre as unknown[])
          .map((g) => (typeof g === 'string' ? g : (g as Record<string, unknown>).name))
          .filter((g): g is string => typeof g === 'string');
      }
    }

    // 2. Fallback: ambil dari elemen HTML biasa
    if (!detail.description) {
      detail.description = $('.header_info .overview p').first().text().trim() || '';
    }
    if (!detail.genres || detail.genres.length === 0) {
      const genres: string[] = [];
      $('a[href*="/genre/"]').each((_, el) => {
        const name = $(el).text().trim();
        if (name && !genres.includes(name)) genres.push(name);
      });
      detail.genres = genres;
    }

    // 3. Durasi film
    detail.duration = $('[data-key="runtime"], .runtime').first().text().replace(/\s+/g, ' ').trim();

    // 4. Trailer YouTube (elemen a.play_trailer memiliki data-id & data-site)
    const trailerEl = $('a.play_trailer[data-id]').first();
    const trailerKey = trailerEl.attr('data-id') ?? '';
    const trailerSite = (trailerEl.attr('data-site') ?? 'YouTube').toLowerCase();
    if (trailerKey && trailerSite === 'youtube') {
      detail.trailerKey = trailerKey;
      detail.trailerUrl = `https://www.youtube.com/watch?v=${trailerKey}`;
    }

    // 5. Fallback: ambil dari halaman /videos
    if (!detail.trailerKey) {
      try {
        const videosRes = await axios.get(`${movieUrl}/videos`, {
          headers: HEADERS,
          timeout: 20000,
        });
        const $v = cheerio.load(videosRes.data);
        const fallbackKey = $v('a[href*="youtube.com/watch?v="]').first().attr('href') ?? '';
        const match = fallbackKey.match(/[?&]v=([A-Za-z0-9_-]+)/);
        if (match) {
          detail.trailerKey = match[1];
          detail.trailerUrl = `https://www.youtube.com/watch?v=${match[1]}`;
        }
      } catch {
        /* halaman /videos gagal — abaikan, trailer boleh kosong */
      }
    }

    return detail;
  } catch (error) {
    console.warn(`⚠️  Gagal mengambil detail: ${movieUrl} -> ${(error as Error).message}`);
    return {};
  }
}

/**
 * Orkestrasi utama: scrape beberapa halaman daftar film, lalu (opsional)
 * lengkapi dengan data detail dari tiap halaman film.
 */
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
    if (page < pageCount) await sleep(800); // jeda sopan antar request
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
    await sleep(500);
  }
  console.log('');
  return results;
}
