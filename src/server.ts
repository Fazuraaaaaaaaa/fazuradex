import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import * as fs from 'fs';
import * as path from 'path';
import { scrapeMovies } from './scraper';
import { saveToJson, saveToCsv } from './utils';
import { resolveEmbedServers, checkEmbedHealth } from './embedProviders';
import { fetchTmdbSearch, fetchTmdbList, fetchMovieById, fetchSeriesById, fetchSeriesEpisodes, fetchMediaById } from './tmdb';
import type { MovieDetail } from './types';

function saveMovies(movies: MovieDetail[]) {
  // deduplicate by TMDB ID
  const map = new Map<string, MovieDetail>();
  movies.forEach(m => map.set(m.id, m));
  const unique = Array.from(map.values());
  fs.writeFileSync(DATA_FILE, JSON.stringify(unique, null, 2), 'utf-8');
  cache = { time: Date.now(), data: unique };
}

import { syncCatalog, getQuickSources } from './syncCatalog';

/** Sinkronisasi background otomatis — menambah terus film "Sedang Tayang di Bioskop", upcoming & trending. */
let isSyncing = false;
let lastSyncAt = 0;

async function autoSyncLatest(reason: string) {
  if (isSyncing) {
    console.log(`⏭️ Auto-sync dilewati (masih berjalan) — pemicu: ${reason}`);
    return;
  }
  isSyncing = true;
  console.log(`🔄 [${reason}] Memulai auto-sync: Now Playing Bioskop, Upcoming, Film Indonesia, Trending...`);
  try {
    const stats = await syncCatalog(getQuickSources(), DATA_FILE, { verbose: false });
    cache = null; // buang cache agar katalog terbaru langsung tersaji
    lastSyncAt = Date.now();
    console.log(`✅ Auto-sync selesai: +${stats.added} baru, ~${stats.updated} diupdate! (Total DB: ${stats.total})`);
  } catch (e) {
    console.error('❌ Auto-sync gagal:', (e as Error).message);
  } finally {
    isSyncing = false;
  }
}

/** Auto-sync berjalan terus: langsung saat server nyala, lalu setiap 1 jam. */
setTimeout(() => void autoSyncLatest('server-start'), 5000);
setInterval(() => void autoSyncLatest('timer-1-jam'), 60 * 60 * 1000);

/**
 * Pemicu tambahan untuk lingkungan serverless (Vercel) yang process-nya mati-nyala:
 * bila data di disk lebih tua dari 1 jam, sinkronisasi dijalankan di background
 * saat ada pengunjung yang membuka katalog.
 */
function maybeStaleSync() {
  const STALE_MS = 60 * 60 * 1000;
  if (isSyncing) return;
  if (lastSyncAt && Date.now() - lastSyncAt < STALE_MS) return;
  try {
    if (Date.now() - fs.statSync(DATA_FILE).mtimeMs < STALE_MS) return;
  } catch {
    /* file belum ada -> boleh sync */
  }
  void autoSyncLatest('stale-request');
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const DATA_FILE = path.resolve(__dirname, '../output/movies.json');
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');

// Optimasi: Keamanan Header
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["*", "data:"],
      mediaSrc: ["*", "blob:"],
      connectSrc: ["*"],
      fontSrc: ["*", "data:"],
      frameSrc: ["*"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  xFrameOptions: { action: "sameorigin" },
}));
// Tambahan header Permissions-Policy
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(cors()); // Allow all origins for production domains (fazuradex.web.id)
app.use(express.json());

// Optimasi: Kompresi response
app.use(compression());

// Optimasi: Rate limiting untuk semua rute API (Cegah abuse/flood ke TMDB)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 150, // Limit tiap IP hingga 150 request (cukup untuk browsing wajar)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Sajikan frontend static dengan Cache-Control (1 hari untuk aset statis)
app.use(express.static(FRONTEND_DIST, {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // HTML tidak di-cache supaya update React langsung terlihat
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

/** Cache sederhana agar tidak membaca file tiap request. */
let cache: { time: number; data: MovieDetail[] } | null = null;

function loadMovies(): MovieDetail[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  if (cache && Date.now() - cache.time < 60_000) return cache.data;
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw) as MovieDetail[];
  cache = { time: Date.now(), data };
  return data;
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** GET /api/movies */
app.get('/api/movies', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  maybeStaleSync();
  const movies = loadMovies();
  const q = String(req.query.q ?? '').toLowerCase().trim();
  const genre = String(req.query.genre ?? '').toLowerCase().trim();
  const collection = String(req.query.collection ?? '').toLowerCase().trim();
  const minRating = Number(req.query.minRating ?? 0);
  const sort = String(req.query.sort ?? 'default');
  const page = Math.max(1, Number(req.query.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(req.query.perPage ?? 24)));

  let result = [...movies];
  let searchTriggered = false;

  // Filter Koleksi (Jika ada, pisahkan dari genre, atau kita match langsung)
  if (collection && collection !== 'all') {
    result = result.filter((m) => (m.collections ?? []).some((c) => c.toLowerCase() === collection));
  }

  if (q) {
    result = result.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.genres ?? []).some((g) => g.toLowerCase().includes(q)),
    );

    // LIVE SEARCH FALLBACK: Jika hasil lokal kurang dari 5, cari langsung ke TMDB API
    if (result.length < 5) {
      const live = await fetchTmdbSearch(q);
      if (live.length > 0) {
        // filter live yang belum ada di local
        const existingIds = new Set(movies.map((m) => m.id));
        const newMovies = live.filter((m) => !existingIds.has(m.id));
        if (newMovies.length > 0) {
          console.log(`ðŸ” Live Search: Menemukan ${newMovies.length} film baru untuk "${q}". Disimpan ke database.`);
          saveMovies([...newMovies, ...movies]);
          // gabungkan live ke result pencarian saat ini
          result = [...live, ...result];
          searchTriggered = true;
          // hilangkan duplikat result just in case
          const uMap = new Map();
          result.forEach(m => uMap.set(m.id, m));
          result = Array.from(uMap.values());
        } else if (live.length > result.length) {
          // kalau sudah ada di DB tapi nggak kena filter kita, perbaiki filter
          const uMap = new Map();
          [...live, ...result].forEach(m => uMap.set(m.id, m));
          result = Array.from(uMap.values());
        }
      }
    }
  }

  if (genre && genre !== 'all') {
    result = result.filter((m) => (m.genres ?? []).some((g) => g.toLowerCase() === genre));
  }
  if (minRating > 0) {
    result = result.filter((m) => (m.ratingValue ?? 0) >= minRating);
  }

  switch (sort) {
    case 'rating_desc': {
      // Skor tertimbang ala IMDb agar film dengan 1 vote tidak menyalip The Godfather.
      const C = 6.5; // rata-rata rating global
      const M = 150; // ambang vote minimal
      const score = (m: MovieDetail) => {
        const v = m.ratingCount ?? 0;
        const R = m.ratingValue ?? 0;
        return (v / (v + M)) * R + (M / (v + M)) * C;
      };
      result.sort((a, b) => score(b) - score(a));
      break;
    }
    case 'title_asc':
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'date_desc':
      result.sort((a, b) => parseDate(b.releaseDateIso || b.releaseDate) - parseDate(a.releaseDateIso || a.releaseDate));
      break;
    case 'date_asc':
      result.sort((a, b) => parseDate(a.releaseDateIso || a.releaseDate) - parseDate(b.releaseDateIso || b.releaseDate));
      break;
  }

  const total = result.length;
  const start = (page - 1) * perPage;
  const paged = result.slice(start, start + perPage);

  res.json({
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage) || 1,
    data: paged,
  });
});

/** GET /api/genres â€” daftar genre unik untuk filter */
app.get('/api/genres', (_req: Request, res: Response) => {
  const movies = loadMovies();
  const genres = new Set<string>();
  movies.forEach((m) => (m.genres ?? []).forEach((g) => genres.add(g)));
  res.json({ data: Array.from(genres).sort() });
});

/** GET /api/movies/stats â€” ringkasan data untuk dashboard */
app.get('/api/movies/stats', (_req: Request, res: Response) => {
  const movies = loadMovies();
  const rated = movies.filter((m) => (m.ratingValue ?? 0) > 0);
  const avg = rated.length
    ? rated.reduce((s, m) => s + (m.ratingValue ?? 0), 0) / rated.length
    : 0;

  const byGenre: Record<string, number> = {};
  movies.forEach((m) =>
    (m.genres ?? []).forEach((g) => {
      byGenre[g] = (byGenre[g] ?? 0) + 1;
    }),
  );

  res.json({
    totalMovies: movies.length,
    averageRating: Number(avg.toFixed(2)),
    totalGenres: Object.keys(byGenre).length,
    genres: Object.entries(byGenre)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    lastUpdated: fs.existsSync(DATA_FILE) ? fs.statSync(DATA_FILE).mtime.toISOString() : null,
  });
});

/**
 * Daftar sumber video legal (open license / public domain) yang dipakai
 * sebagai katalog streaming. Semua item di bawah ini adalah film buatan
 * sendiri (Blender Open Movies) atau stream uji resmi dari penyedia CDN HLS
 * yang memang dipublikasikan untuk keperluan demo/embedding.
 */
const STREAM_CATALOG = [
  {
    // Blender Open Movie - Big Buck Bunny (multi-bitrate HLS)
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    label: 'Big Buck Bunny (Open Movie)',
  },
  {
    // Blender Open Movie - Tears of Steel (HLS + subtitle track)
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    label: 'Tears of Steel (Open Movie)',
  },
  {
    // Mux VOD test stream (Adaptive bitrate + thumbnail)
    url: 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
    label: 'Mux Open Test Stream',
  },
];

/** Hash sederhana agar 1 film selalu mendapat stream yang sama (konsisten). */
function pickStream(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return STREAM_CATALOG[hash % STREAM_CATALOG.length];
}

/** GET /api/movies/:id/health â€” cek kesehatan server video sebelum dimainkan */
app.get('/api/movies/:id/health', async (req: Request, res: Response) => {
  const movies = loadMovies();
  const movie = movies.find((m) => m.id === req.params.id);
  if (!movie) {
    res.status(404).json({ error: 'Film tidak ditemukan' });
    return;
  }
  const season = parseInt(req.query.season as string) || 1;
  const episode = parseInt(req.query.episode as string) || 1;
  const tmdbId = movie.tmdbId || movie.id;
  const health = await checkEmbedHealth(String(tmdbId), movie.mediaType || 'movie', season, episode);
  res.json(health);
});

/** GET /api/movies/:id/stream â€” resolve URL HLS / Iframe untuk player */
app.get('/api/movies/:id/stream', async (req: Request, res: Response) => {
  let movies = loadMovies();
  let movie = movies.find((m) => m.id === req.params.id);
  const season = parseInt(req.query.season as string) || 1;
  const episode = parseInt(req.query.episode as string) || 1;

  // "Self-healing": konten belum ada di katalog lokal â†’ tarik lengkap dari TMDB.
  if (!movie) {
    const fetched = await fetchMediaById(String(req.params.id));
    if (fetched) {
      saveMovies([fetched, ...movies]);
      movie = fetched;
    }
  }

  if (!movie) {
    res.status(404).json({ error: 'Film tidak ditemukan' });
    return;
  }

  const tmdbId = movie.tmdbId || movie.id;
  const mediaType = movie.mediaType || 'movie';

  // 1. Cek secara real-time dan kembalikan HANYA server yang valid/bisa memutar
  const streamList = await resolveEmbedServers(tmdbId, movie.title, mediaType, season, episode);

  if (streamList.length === 0) {
    res.json({
      id: movie.id,
      title: movie.title,
      streams: [],
      error: 'Konten/episode ini belum tersedia di server pemutar.',
    });
    return;
  }

  res.json({
    id: movie.id,
    title: movie.title,
    posterUrl: movie.posterUrl,
    description: movie.description,
    year: movie.releaseDate?.match(/(19|20)\d{2}/)?.[0] || 'Unknown',
    streams: streamList, // Kirim semua stream yang lulus uji
    streamUrl: streamList[0].url,
    type: streamList[0].type,
    sourceLabel: streamList[0].serverName,
    mediaType,
    season,
    episode,
  });
});

// === COMMENTS SYSTEM ===
const COMMENTS_FILE = path.join(path.dirname(DATA_FILE), 'comments.json');
let commentsStore: Record<string, any[]> = {};
app.get('/api/movies/:id/episodes', async (req: Request, res: Response) => {
  const movieId = String(req.params.id);
  const season = parseInt(req.query.season as string) || 1;
  const episodes = await fetchSeriesEpisodes(movieId, season);
  if (!episodes || episodes.length === 0) {
    res.status(404).json({ error: 'Episode tidak ditemukan' });
    return;
  }
  res.json({ status: 'ok', data: episodes });
});

app.get('/api/movies/:id/seasons', async (req: Request, res: Response) => {
  const movieId = String(req.params.id);
  const series = await fetchSeriesById(movieId);
  if (!series || !series.seasons) {
    res.status(404).json({ error: 'Data serial tidak ditemukan' });
    return;
  }
  res.json({ status: 'ok', data: series.seasons });
});
if (fs.existsSync(COMMENTS_FILE)) {
  try {
    commentsStore = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
  } catch (e) {
    console.error('âš ï¸ Gagal membaca comments.json:', (e as Error).message);
  }
}

app.get('/api/movies/:id/comments', (req: Request, res: Response) => {
  const movieId = String(req.params.id);
  const movieComments = commentsStore[movieId] || [];
  res.json({ status: 'ok', data: movieComments });
});

app.post('/api/movies/:id/comments', express.json(), (req: Request, res: Response) => {
  const movieId = String(req.params.id);
  const { author, text, rating, isSpoiler } = req.body;
  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: 'Komentar tidak boleh kosong' });
    return;
  }
  
  if (!commentsStore[movieId]) commentsStore[movieId] = [];
  
  const newComment = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    author: author || 'Anonim',
    text: text.trim(),
    rating: rating ? Number(rating) : undefined,
    isSpoiler: Boolean(isSpoiler),
    createdAt: new Date().toISOString(),
  };
  
  commentsStore[movieId].push(newComment);
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(commentsStore, null, 2), 'utf-8');
  
  res.json({ status: 'ok', data: newComment });
});

/** GET /api/movies/:id â€” detail satu film */
app.get('/api/movies/:id', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  let movies = loadMovies();
  let movie = movies.find((m) => m.id === req.params.id);

  if (!movie || (!movie.duration && !movie.cast && !movie.trailerUrl)) {
    const fetched = await fetchMediaById(String(req.params.id));
    if (fetched) {
      // update or insert
      const newMovies = movies.filter(m => m.id !== fetched.id);
      saveMovies([fetched, ...newMovies]);
      movie = fetched;
      movies = loadMovies(); // refresh list
    }
  }

  if (!movie) {
    res.status(404).json({ error: 'Film tidak ditemukan' });
    return;
  }

  const related = movies
    .filter(
      (m) =>
        m.id !== movie!.id &&
        (m.genres ?? []).some((g) => (movie!.genres ?? []).includes(g)),
    )
    .slice(0, 6);
  res.json({ data: movie, related });
});

/** POST /api/refresh */
app.post('/api/refresh', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await syncCatalog(getQuickSources(), DATA_FILE, { verbose: false });
    cache = null; // buang cache
    res.json({ success: true, added: stats.added, updated: stats.updated, total: stats.total });
  } catch (err) {
    next(err);
  }
});

function parseDate(str: string): number {
  const t = Date.parse(str);
  return Number.isNaN(t) ? 0 : t;
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: err.message });
});

// SPA Fallback jika file static ada (middleware aman untuk Express 4 & 5)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api') || req.method !== 'GET') {
    return next();
  }
  const indexHtml = path.join(FRONTEND_DIST, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  next();
});

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 FazuraDex Fullstack Server berjalan di http://localhost:${PORT}`);
    console.log(`   - Frontend Web UI: http://localhost:${PORT}`);
    console.log(`   - API Endpoint   : http://localhost:${PORT}/api/movies`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} sudah dipakai aplikasi/proses lain.`);
      console.error('   Ganti port dengan:  $env:PORT=4001; npm run dev:api');
      console.error('   Atau tutup proses lama:  taskkill /F /IM node.exe\n');
    } else {
      console.error('Gagal memulai server:', err.message);
    }
    process.exit(1);
  });
}

export default app;

