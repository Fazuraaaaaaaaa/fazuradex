export interface MovieItem {
  id: string;
  title: string;
  /** Tanggal rilis siap tampil (mis. "22 Mei 2024"). */
  releaseDate: string;
  /** Tanggal rilis mentah format ISO "YYYY-MM-DD" (untuk sorting akurat). */
  releaseDateIso?: string;
  url: string;
  posterUrl: string;
}

export interface MovieDetail extends MovieItem {
  description?: string;
  ratingValue?: number;
  ratingCount?: number;
  genres?: string[];
  duration?: string;
  trailerKey?: string;
  trailerUrl?: string;
  /** Gambar latar (backdrop TMDB w1280) untuk efek sinematik. */
  backdropUrl?: string;
  /** Daftar nama pemeran utama. */
  cast?: string[];
  /** Genre/kategori sumber list TMDB (popular, top_rated, now_playing, upcoming). */
  collections?: string[];
  /** ID asli TMDB. */
  tmdbId?: string;
  mediaType?: 'movie' | 'tv';
  seasonsCount?: number;
}

export interface ScrapeOptions {
  pageCount?: number;
  fetchDetails?: boolean;
}
