import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { MovieGrid } from './components/MovieGrid';
import { MovieModal, type Movie } from './components/MovieModal';
import { VideoPlayer } from './components/VideoPlayer';
import { HistoryModal } from './components/HistoryModal';
import { Play, Info, Star, Flame, X } from 'lucide-react';

interface HeroSectionProps {
  movie: Movie;
  onWatch: () => void;
  onDetail: () => void;
}

export function HeroSection({ movie, onWatch, onDetail }: HeroSectionProps) {
  const yearMatch = movie.releaseDate?.match(/(19|20)\d{2}/);
  const year = yearMatch ? yearMatch[0] : '';

  return (
    <section className="relative h-[380px] sm:h-[420px] md:h-[520px] w-full -mt-16 z-0 mb-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        {movie.posterUrl && (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover object-top scale-105 blur-[2px]"
          />
        )}
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col justify-end pb-10 md:justify-center md:pb-0">
        <div className="max-w-xl flex flex-col gap-3 md:gap-4">
          {/* Trending Badge */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-red-600/90 text-white text-[10px] md:text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-red-600/30">
              <Flame className="w-3.5 h-3.5" />
              Trending
            </span>
            {year && <span className="text-zinc-400 text-[11px] md:text-xs font-medium">{year}</span>}
            {(movie.ratingValue ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-amber-400 text-[11px] md:text-xs font-bold">
                <Star className="w-3 h-3 fill-amber-400" />
                {movie.ratingValue?.toFixed(1)}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-black text-white leading-[1.1] tracking-tight drop-shadow-lg line-clamp-2">
            {movie.title}
          </h1>

          {/* Genres / Description */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            {(movie.genres ?? []).slice(0, 3).map((g) => (
              <span
                key={g}
                className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-300 uppercase tracking-wider"
              >
                {g}
              </span>
            ))}
          </div>

          <p className="hidden sm:block text-zinc-300/90 text-xs md:text-sm leading-relaxed line-clamp-2 max-w-lg drop-shadow">
            {movie.description || 'Nonton sekarang dengan kualitas terbaik hanya di FazuraDex.'}
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={onWatch}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs md:text-sm px-5 md:px-7 py-2.5 md:py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-600/40"
            >
              <Play className="w-4 h-4 fill-current" />
              Watch Now
            </button>
            <button
              onClick={onDetail}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-xs md:text-sm px-5 md:px-7 py-2.5 md:py-3.5 rounded-xl border border-white/15 transition-all hover:scale-105 active:scale-95"
            >
              <Info className="w-4 h-4" />
              Details
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StreamItem {
  serverId: string;
  serverName: string;
  type: 'youtube' | 'hls' | 'mp4' | 'iframe';
  url: string;
  quality: string;
}

interface StreamInfo {
  id: string;
  title: string;
  streamUrl: string;
  posterUrl?: string;
  type: string;
  description?: string;
  year?: string;
  streams?: StreamItem[];
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

const COLLECTION_LABELS: Record<string, string> = {
  all: 'Semua Film',
  popular: 'Film Paling Populer',
  top_rated: 'Film Top Rating',
  now_playing: 'Sedang Tayang di Bioskop',
  upcoming: 'Segera Hadir / Upcoming',
  indonesia: 'Film Indonesia Terbaik',
  anime: 'Anime & Animasi Terbaik',
  horror: 'Horor & Thriller',
  action: 'Action Blockbuster',
  scifi: 'Sci-Fi & Fantasy',
  romance: 'Romance & Drama',
};

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState('');
  const [totalInDb, setTotalInDb] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [collection, setCollection] = useState('all');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMovies, setTotalMovies] = useState(0);

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [playingMovie, setPlayingMovie] = useState<StreamInfo | null>(null);

  const [watchHistory, setWatchHistory] = useState<Movie[]>([]);
  const [showAdNotice, setShowAdNotice] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);

  useEffect(() => {
    fetch('/api/genres')
      .then((res) => res.json())
      .then((data) => {
        setGenres(data.genres?.map((g: any) => g.name) || data.data || []);
      });

    fetch('/api/movies/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.lastUpdated) {
          const dt = new Date(data.lastUpdated);
          setLastSync(dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');
        }
        if (data.totalMovies) {
          setTotalInDb(data.totalMovies);
        }
      });

    fetch('/api/movies/969681')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.data) {
          setHeroMovie(data.data);
        }
      })
      .catch(console.error);

    try {
      const histStr = localStorage.getItem('watch_history');
      if (histStr) {
        setWatchHistory(JSON.parse(histStr));
      }
    } catch (e) {
      console.error(e);
    }

    // Auto-open deep linked movie (?watch=123)
    const watchId = new URLSearchParams(window.location.search).get('watch');
    if (watchId) {
      fetch(`/api/movies/${watchId}`)
        .then((res) => res.json())
        .then((movie) => {
          if (movie && movie.id) {
            setSelectedMovie(movie);
          }
        })
        .catch(() => {});
    }

    // Tampilkan pop-up iklan hanya sekali
    if (!localStorage.getItem('ad_notice_seen')) {
      setShowAdNotice(true);
    }
  }, []);

  // Update watch history state whenever playingMovie changes (since it's saved in VideoPlayer)
  useEffect(() => {
    if (playingMovie) {
      try {
        const histStr = localStorage.getItem('watch_history');
        if (histStr) {
          setWatchHistory(JSON.parse(histStr));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [playingMovie]);

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/movies', window.location.origin);
      url.searchParams.set('page', page.toString());
      if (searchQuery) url.searchParams.set('q', searchQuery);
      if (selectedGenre !== 'all') url.searchParams.set('genre', selectedGenre);
      if (collection !== 'all') url.searchParams.set('collection', collection);
      if (sort !== 'default') url.searchParams.set('sort', sort);

      const res = await fetch(url.toString());
      const data = await res.json();
      setMovies(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalMovies(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchMovies, 300);
    return () => clearTimeout(timeout);
  }, [page, searchQuery, selectedGenre, collection, sort]);



  const handleWatch = async (movie: Movie, season?: number, episode?: number) => {
    try {
      const q = new URLSearchParams();
      if (season) q.set('season', season.toString());
      if (episode) q.set('episode', episode.toString());
      const res = await fetch(`/api/movies/${movie.id}/stream?${q.toString()}`);
      const data = await res.json();
      if (data.streams && data.streams.length > 0) {
        setSelectedMovie(null);
        setPlayingMovie({
          id: data.id,
          title: data.title,
          streamUrl: data.streamUrl,
          posterUrl: data.posterUrl,
          type: data.type,
          description: data.description,
          year: data.year,
          streams: data.streams,
          mediaType: data.mediaType,
          season: data.season,
          episode: data.episode,
        });
      } else {
        alert(data.error || 'Maaf, konten ini belum tersedia di server pemutar!');
      }
    } catch (err) {
      alert('Gagal menghubungi server: ' + err);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col bg-night-900">
      {/* Subtle, mature dark gradient background */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-zinc-950 via-night-900 to-night-900 pointer-events-none" />

      <Header
        searchQuery={searchQuery}
        onSearchChange={(v) => {
          setSearchQuery(v);
          setPage(1);
        }}
        activeTab={collection}
        onTabChange={(tab) => {
          if (['home', 'ongoing', 'top_rated', 'anime'].includes(tab)) {
            setCollection(tab === 'home' ? 'all' : tab === 'ongoing' ? 'now_playing' : tab);
            setSearchQuery('');
            setPage(1);
          }
        }}
        watchHistoryCount={watchHistory.length}
        onOpenHistory={() => {
          setShowHistoryModal(true);
        }}
      />

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
        
        {/* Render Hero Section only on main page */}
        {page === 1 && !searchQuery && collection === 'all' && (heroMovie ?? (movies.length > 0 ? movies[0] : null)) && (
          <HeroSection
            movie={heroMovie ?? movies[0]}
            onWatch={() => handleWatch(heroMovie ?? movies[0])}
            onDetail={() => setSelectedMovie(heroMovie ?? movies[0])}
          />
        )}

        {watchHistory.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                Lanjutkan Menonton
              </h2>
              <button
                onClick={() => {
                  localStorage.removeItem('watch_history');
                  setWatchHistory([]);
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Hapus Riwayat
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 hide-scrollbar">
              {watchHistory.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleWatch(m)}
                  className="flex-shrink-0 w-36 sm:w-44 group cursor-pointer"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-night-800 shadow-lg group-hover:scale-105 group-hover:border-brand-500/50 transition-all duration-300">
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                      <div className="w-10 h-10 rounded-full bg-brand-500/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        ▶
                      </div>
                    </div>
                  </div>
                  <h3 className="text-xs font-semibold text-white truncate mt-2 group-hover:text-brand-400 transition-colors">
                    {m.title}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        )}

        <FilterBar
          genres={genres}
          selectedGenre={selectedGenre}
          onGenreSelect={(g) => {
            setSelectedGenre(g);
            setPage(1);
          }}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          collection={collection}
          onCollectionChange={(c) => {
            setCollection(c);
            setPage(1);
          }}
        />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold font-display text-white">
            {COLLECTION_LABELS[collection] ?? 'Katalog Film'}
            {selectedGenre !== 'all' ? ` • ${selectedGenre}` : ''}
            {searchQuery ? ` • "${searchQuery}"` : ''}
          </h2>
          <div className="flex items-center gap-3">
            {lastSync && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1" title={`Total ${totalInDb} film di database`}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Auto-sync terakhir: {lastSync}
              </span>
            )}
            <p className="text-gray-400 text-sm font-medium">{totalMovies} film</p>
          </div>
        </div>

        <MovieGrid
          movies={movies}
          loading={loading}
          onSelect={(movie) => handleWatch(movie)}
          onDetail={(movie) => setSelectedMovie(movie)}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg bg-night-800 text-sm hover:bg-night-700 disabled:opacity-50 transition-colors"
            >
              Sebelumnya
            </button>
            <span className="text-sm font-medium text-gray-400 px-4">
              Halaman <span className="text-white">{page}</span> / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-lg bg-night-800 text-sm hover:bg-night-700 disabled:opacity-50 transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        )}
      </main>
        {/* TMDB Attribution Footer */}
        <footer className="mt-12 py-6 border-t border-white/10 text-center">
          <p className="text-zinc-500 text-xs sm:text-sm">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </footer>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onWatch={handleWatch}
        />
      )}

      {playingMovie && (
        <VideoPlayer
          movie={playingMovie}
          onClose={() => setPlayingMovie(null)}
          onNextEpisode={
            playingMovie.mediaType === 'tv' && playingMovie.season && playingMovie.episode
              ? () => handleWatch(playingMovie as any, playingMovie.season, (playingMovie.episode || 1) + 1)
              : undefined
          }
        />
      )}
      {/* History Modal */}
      {showHistoryModal && (
        <HistoryModal
          history={watchHistory}
          onClose={() => setShowHistoryModal(false)}
          onWatch={(m) => handleWatch(m)}
          onClearAll={() => {
            localStorage.removeItem('watch_history');
            setWatchHistory([]);
          }}
          onRemoveItem={(id) => {
            const next = watchHistory.filter((m) => m.id !== id);
            localStorage.setItem('watch_history', JSON.stringify(next));
            setWatchHistory(next);
          }}
        />
      )}

      {/* Ad Notice Modal */}
      {showAdNotice && (
        <div 
          onClick={() => {
            localStorage.setItem('ad_notice_seen', 'true');
            setShowAdNotice(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#16161f] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-fade-up"
          >
            <button 
              onClick={() => {
                localStorage.setItem('ad_notice_seen', 'true');
                setShowAdNotice(false);
              }}
              className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mb-4">
              <Info className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Pemberitahuan Iklan</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
              Saat menekan tombol <b>Play</b> atau kontrol video, tab/jendela baru mungkin akan terbuka berisi iklan (bawaan dari server streaming pihak ketiga).
              <br/><br/>
              <br/><br/>
              <b>Atribusi TMDB:</b> Aplikasi ini menggunakan API TMDB tetapi tidak didukung atau disertifikasi oleh TMDB.
              Silakan <b>tutup tab iklan tersebut</b> dan kembali ke FazuraDex untuk lanjut menonton tanpa gangguan.
            </p>
            <button
              onClick={() => {
                localStorage.setItem('ad_notice_seen', 'true');
                setShowAdNotice(false);
              }}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/25 active:scale-[0.98]"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
