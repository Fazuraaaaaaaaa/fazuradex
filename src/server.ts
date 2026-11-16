import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import * as fs from 'fs';
import * as path from 'path';
import { safeWriteJson } from './utils';
import { resolveEmbedServers, checkEmbedHealth } from './embedProviders';
import { fetchTmdbSearch, fetchTmdbList, fetchMovieById, fetchSeriesById, fetchSeriesEpisodes, fetchMediaById } from './tmdb';
import type { MovieDetail } from './types';

const app = express();
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT) || 4000;
const DATA_FILE = path.resolve(__dirname, '../output/movies.json');
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');

/** Cache sederhana agar tidak membaca file tiap request. */
let cache: { time: number; data: MovieDetail[] } | null = null;

function saveMovies(movies: MovieDetail[]) {
  // deduplicate by TMDB ID
  const map = new Map<string, MovieDetail>();
  movies.forEach(m => map.set(m.id, m));
  const unique = Array.from(map.values());
  cache = { time: Date.now(), data: unique };
  try {
    safeWriteJson(DATA_FILE, unique, true);
  } catch (e) {
    console.warn('⚠️ Tidak dapat menulis movies.json ke disk (lingkungan serverless/read-only):', (e as Error).message);
  }
}

// Sinkronisasi katalog tidak boleh berjalan dari process API/serverless.
// Jalankan secara eksplisit melalui `npm run sync`, lalu deploy output/movies.json
// yang dihasilkan. Menjalankan sinkronisasi TMDB per instance atau per request akan
// menghabiskan Fluid Active CPU dan filesystem Vercel tidak menyimpan hasilnya.

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
  max: 300, // Limit tiap IP hingga 300 request (cukup untuk browsing, search, dan switching server)
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

function loadMovies(): MovieDetail[] {
  if (cache && Date.now() - cache.time < 60_000) return cache.data;
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw) as MovieDetail[];
    cache = { time: Date.now(), data };
    return data;
  } catch (e) {
    console.error('⚠️ Gagal membaca movies.json:', (e as Error).message);
    return cache ? cache.data : [];
  }
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** GET /api/movies */
app.get('/api/movies', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
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
      try {
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
    } catch (err) {
      console.warn('⚠️ Live search TMDB gagal:', (err as Error).message);
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
    case 'default':
      // Beranda & kategori umum hanya menampilkan film yang sudah tayang sampai hari ini.
      // Film masa depan (2027, 2028, dst) hanya boleh muncul bila user membuka koleksi "upcoming".
      if (collection !== 'upcoming') {
        const today = Date.now();
        result = result.filter((m) => {
          const t = parseDate(m.releaseDateIso || m.releaseDate);
          return t > 0 && t <= today;
        });
      }
      result.sort((a, b) => parseDate(b.releaseDateIso || b.releaseDate) - parseDate(a.releaseDateIso || a.releaseDate));
      break;
    case 'date_desc':
      if (collection !== 'upcoming') {
        const today = Date.now();
        result = result.filter((m) => {
          const t = parseDate(m.releaseDateIso || m.releaseDate);
          return t > 0 && t <= today;
        });
      }
      result.sort((a, b) => parseDate(b.releaseDateIso || b.releaseDate) - parseDate(a.releaseDateIso || a.releaseDate));
      break;
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

/** GET /api/movies/:id/health — cek kesehatan server video sebelum dimainkan */
app.get('/api/movies/:id/health', async (req: Request, res: Response) => {
  try {
    const movies = loadMovies();
    let movie = movies.find((m) => m.id === req.params.id);
    if (!movie) {
      const fetched = await fetchMediaById(String(req.params.id));
      if (fetched) movie = fetched;
    }
    if (!movie) {
      res.status(404).json({ error: 'Film tidak ditemukan' });
      return;
    }
    const season = parseInt(req.query.season as string) || 1;
    const episode = parseInt(req.query.episode as string) || 1;
    const tmdbId = movie.tmdbId || movie.id;
    const health = await checkEmbedHealth(String(tmdbId), movie.mediaType || 'movie', season, episode);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengecek kesehatan stream', message: (err as Error).message });
  }
});

/** GET /api/movies/:id/stream — resolve URL HLS / Iframe untuk player */
app.get('/api/movies/:id/stream', async (req: Request, res: Response) => {
  try {
    let movies = loadMovies();
    let movie = movies.find((m) => m.id === req.params.id);
    const season = parseInt(req.query.season as string) || 1;
    const episode = parseInt(req.query.episode as string) || 1;

    // "Self-healing": konten belum ada di katalog lokal → tarik lengkap dari TMDB.
    if (!movie) {
      try {
        const fetched = await fetchMediaById(String(req.params.id));
        if (fetched) {
          saveMovies([fetched, ...movies]);
          movie = fetched;
        }
      } catch (err) {
        console.warn('⚠️ Gagal fetch media on-demand:', (err as Error).message);
      }
    }

    if (!movie) {
      res.status(404).json({ error: 'Film tidak ditemukan' });
      return;
    }

    const tmdbId = movie.tmdbId || movie.id;
    const mediaType = movie.mediaType || 'movie';

    // 1. Ambil semua server embed yang tersedia untuk film ini
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
      streams: streamList, // Kirim semua server ke frontend
      streamUrl: streamList[0].url,
      type: streamList[0].type,
      sourceLabel: streamList[0].serverName,
      mediaType,
      season,
      episode,
    });
  } catch (err) {
    console.error('Stream resolver error:', (err as Error).message);
    res.status(500).json({ error: 'Gagal memuat sumber stream video' });
  }
});

// === COMMENTS SYSTEM ===
const COMMENTS_FILE = path.join(path.dirname(DATA_FILE), 'comments.json');
let commentsStore: Record<string, any[]> = {};
if (fs.existsSync(COMMENTS_FILE)) {
  try {
    commentsStore = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
  } catch (e) {
    console.error('⚠️ Gagal membaca comments.json:', (e as Error).message);
  }
}

app.get('/api/movies/:id/episodes', async (req: Request, res: Response) => {
  try {
    const movieId = String(req.params.id);
    const season = parseInt(req.query.season as string) || 1;
    const episodes = await fetchSeriesEpisodes(movieId, season);
    if (!episodes || episodes.length === 0) {
      res.status(404).json({ error: 'Episode tidak ditemukan' });
      return;
    }
    res.json({ status: 'ok', data: episodes });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat episode serial' });
  }
});

app.get('/api/movies/:id/seasons', async (req: Request, res: Response) => {
  try {
    const movieId = String(req.params.id);
    const series = await fetchSeriesById(movieId);
    if (!series || !series.seasons) {
      res.status(404).json({ error: 'Data serial tidak ditemukan' });
      return;
    }
    res.json({ status: 'ok', data: series.seasons });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat data serial' });
  }
});
app.get('/api/movies/:id/comments', (req: Request, res: Response) => {
  const movieId = String(req.params.id);
  const movieComments = commentsStore[movieId] || [];
  res.json({ status: 'ok', data: movieComments });
});

app.post('/api/movies/:id/comments', (req: Request, res: Response) => {
  const movieId = String(req.params.id);
  const { author, text, rating, isSpoiler } = req.body || {};
  
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    res.status(400).json({ error: 'Komentar tidak boleh kosong' });
    return;
  }
  if (cleanText.length > 1000) {
    res.status(400).json({ error: 'Komentar terlalu panjang (maksimal 1000 karakter)' });
    return;
  }

  const cleanAuthor = String(author || 'Anonim').trim().slice(0, 50) || 'Anonim';
  const numRating = rating !== undefined && rating !== null ? Number(rating) : undefined;
  const validRating = numRating !== undefined && !Number.isNaN(numRating) ? Math.min(10, Math.max(1, numRating)) : undefined;

  if (!commentsStore[movieId]) commentsStore[movieId] = [];
  
  const newComment = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    author: cleanAuthor,
    text: cleanText,
    rating: validRating,
    isSpoiler: Boolean(isSpoiler),
    createdAt: new Date().toISOString(),
  };
  
  commentsStore[movieId].push(newComment);
  try {
    safeWriteJson(COMMENTS_FILE, commentsStore, true);
  } catch (e) {
    console.warn('⚠️ Gagal menyimpan comments.json (lingkungan serverless/read-only):', (e as Error).message);
  }
  
  res.json({ status: 'ok', data: newComment });
});

/** GET /api/movies/:id â€” detail satu film */
app.get('/api/movies/:id', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  let movies = loadMovies();
  let movie = movies.find((m) => m.id === req.params.id);

  if (!movie || (!movie.duration && !movie.cast && !movie.trailerUrl)) {
    try {
      const fetched = await fetchMediaById(String(req.params.id));
      if (fetched) {
        // update or insert
        const newMovies = movies.filter(m => m.id !== fetched.id);
        saveMovies([fetched, ...newMovies]);
        movie = fetched;
        movies = loadMovies(); // refresh list
      }
    } catch (err) {
      console.warn('⚠️ Gagal fetch detail on-demand:', (err as Error).message);
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

/** POST /api/refresh — disabled in serverless production. */
app.post('/api/refresh', (_req: Request, res: Response) => {
  res.status(503).json({
    success: false,
    error: 'Catalog refresh is disabled in production. Run `npm run sync` before deploying.',
  });
});

function parseDate(str: string): number {
  const t = Date.parse(str);
  return Number.isNaN(t) ? 0 : t;
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err.message);
  res.status(500).json({
    error: 'Terjadi kesalahan internal pada server',
    ...(process.env.NODE_ENV !== 'production' ? { details: err.message } : {}),
  });
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

if (!process.env.VERCEL) {
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

