import { CalendarDays, Clock, Star, PlayCircle, Film, Share2, ListVideo, Tv, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CommentsSection } from './CommentsSection';

export interface Movie {
  id: string;
  title: string;
  releaseDate: string;
  url: string;
  posterUrl: string;
  description?: string;
  ratingValue?: number;
  ratingCount?: number;
  genres?: string[];
  duration?: string;
  trailerKey?: string;
  trailerUrl?: string;
  mediaType?: 'movie' | 'tv';
}

interface MovieModalProps {
  movie: Movie;
  onClose: () => void;
  onWatch: (movie: Movie, season?: number, episode?: number) => void;
}

export function MovieModal({ movie, onClose, onWatch }: MovieModalProps) {
  const hasTrailer = Boolean(movie.trailerKey);
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${movie.title} ${movie.releaseDate ? new Date(movie.releaseDate).getFullYear() ?? movie.releaseDate : ''} official trailer`
  )}`;
  const [copied, setCopied] = useState(false);
  const [showTvModal, setShowTvModal] = useState(false);
  const isTv = movie.mediaType === 'tv';
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [isPlayable, setIsPlayable] = useState<boolean | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(true);

  useEffect(() => {
    setCheckingHealth(true);
    fetch(`/api/movies/${movie.id}/health`)
      .then((res) => res.json())
      .then((data) => {
        setIsPlayable(data.hasPlayableSource ?? true);
      })
      .catch(() => {
        setIsPlayable(true);
      })
      .finally(() => {
        setCheckingHealth(false);
      });
  }, [movie.id]);

  useEffect(() => {
    if (isTv) {
      fetch(`/api/movies/${movie.id}/seasons`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setSeasons(data.data);
          }
        })
        .catch(() => {});
    }
  }, [movie.id, isTv]);

  useEffect(() => {
    if (isTv) {
      setLoadingEpisodes(true);
      fetch(`/api/movies/${movie.id}/episodes?season=${selectedSeason}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setEpisodes(data.data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingEpisodes(false));
    }
  }, [movie.id, selectedSeason, isTv]);


  const handleShare = async () => {
    const url = `${window.location.origin}/?watch=${movie.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${movie.title} - FazuraDex`,
          text: movie.description || `Nonton ${movie.title} di FazuraDex`,
          url,
        });
        return;
      } catch (err) {
        // user cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`Salin link: ${url}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/90 transition-opacity" />

      <div
        className="relative w-full h-full sm:h-auto sm:max-w-4xl bg-night-900 sm:border border-zinc-800 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:max-h-[90vh] animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black transition-colors border border-white/10"
        >
          ✕
        </button>

        {/* === Trailer Video Player (YouTube Embed) === */}
        {hasTrailer ? (
          <div className="w-full aspect-video bg-black shrink-0 border-b border-zinc-800">
            <iframe
              src={`https://www.youtube.com/embed/${movie.trailerKey}?rel=0&modestbranding=1`}
              title={`Trailer — ${movie.title}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="w-full aspect-video shrink-0 bg-night-800 flex flex-col items-center justify-center gap-3 border-b border-zinc-800 relative">
            <div className="absolute inset-0 opacity-20 bg-cover bg-center blur-xl" style={{ backgroundImage: `url(${movie.posterUrl})` }}></div>
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="w-24 h-36 object-cover rounded shadow-2xl relative z-10"
            />
            <p className="text-zinc-500 text-sm font-medium relative z-10">Trailer tidak tersedia</p>
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700 text-xs font-semibold hover:bg-zinc-700 transition-colors relative z-10"
            >
              <Film className="w-4 h-4" />
              Cari di YouTube
            </a>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-0">
            {/* Poster kecil */}
            <div className="hidden md:block w-[200px] shrink-0 pt-8 pl-8">
              {isPlayable === false ? (
                <div className="w-full aspect-[2/3] rounded border border-dashed border-zinc-800 bg-night-800 flex flex-col items-center justify-center p-4 text-center">
                  <Film className="w-8 h-8 text-zinc-600 mb-2" />
                  <span className="text-xs text-zinc-500 font-medium">Poster disembunyikan (Sumber video offline)</span>
                </div>
              ) : (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full rounded border border-zinc-800 object-cover shadow-xl"
                />
              )}
            </div>

            {/* Detail info */}
            <div className="flex-1 p-6 md:p-8">
              <div className="flex flex-wrap gap-2 mb-4">
                {(movie.genres || []).map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-wider border border-zinc-700"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-3 tracking-tight leading-tight">
                {movie.title}
              </h2>

              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 font-medium mb-6 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-zinc-500" />
                  {movie.releaseDate}
                </div>
                {movie.duration && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    {movie.duration}
                  </div>
                )}
                {(movie.ratingValue ?? 0) > 0 && (
                  <div className="flex items-center gap-1 text-gold">
                    <Star className="w-4 h-4 fill-gold" />
                    <span className="font-bold text-zinc-200">{movie.ratingValue?.toFixed(1)}</span>
                    <span className="text-zinc-600 font-normal normal-case tracking-normal">({movie.ratingCount} votes)</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest border-b border-zinc-800 pb-2">
                  Sinopsis
                </h3>
                <p className="text-zinc-400 leading-relaxed text-sm">
                  {movie.description || 'Tidak ada sinopsis yang tersedia untuk film ini.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {isPlayable === false ? (
                  <div className="flex items-center gap-2 px-5 py-3 rounded text-sm bg-zinc-800/80 text-zinc-500 font-bold border border-dashed border-zinc-700 w-full">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Semua server video sedang bermasalah — poster disembunyikan sementara. Silakan coba lagi nanti.</span>
                  </div>
                ) : (
                  <button
                    onClick={() => (isTv ? onWatch(movie, 1, 1) : onWatch(movie))}
                    disabled={checkingHealth}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded text-sm bg-brand-500 text-white font-bold hover:bg-brand-600 transition-colors shadow-lg disabled:opacity-60"
                  >
                    <PlayCircle className="w-5 h-5" />
                    {checkingHealth ? 'Cek Server...' : isTv ? 'Tonton S1:E1' : 'Tonton Sekarang'}
                  </button>
                )}
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded text-sm bg-zinc-800 text-zinc-200 font-bold hover:bg-zinc-700 transition-colors border border-zinc-700"
                >
                  <Share2 className="w-4 h-4" />
                  {copied ? 'Tersalin!' : 'Bagikan'}
                </button>
                <button
                  onClick={() => setShowTvModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded text-sm bg-zinc-800 text-zinc-200 font-bold hover:bg-zinc-700 transition-colors border border-zinc-700"
                >
                  <Tv className="w-4 h-4" />
                  Tonton di TV
                </button>
                <a
                  href={movie.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded text-sm bg-transparent text-zinc-400 font-semibold hover:text-zinc-200 transition-colors"
                >
                  TMDB ↗
                </a>
              </div>
              {/* TV Episodes Drawer */}
              {isTv && (
                <div className="mt-8 pt-6 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ListVideo className="w-5 h-5 text-zinc-400" />
                      <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">
                        Pilih Episode
                      </h3>
                    </div>
                    {seasons.length > 0 && (
                      <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(Number(e.target.value))}
                        className="bg-night-900 border border-zinc-700 text-xs rounded py-1.5 px-3 text-zinc-200 focus:outline-none focus:border-zinc-500 font-bold"
                      >
                        {seasons.map((s) => (
                          <option key={s.seasonNumber} value={s.seasonNumber}>
                            {s.name} ({s.episodeCount} eps)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {loadingEpisodes ? (
                    <div className="py-8 flex justify-center text-zinc-500 text-sm">Memuat episode...</div>
                  ) : episodes.length === 0 ? (
                    <div className="py-8 flex justify-center text-zinc-500 text-sm">Episode belum tersedia di database.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto hide-scrollbar pr-2">
                      {episodes.map((ep) => (
                        <div
                          key={ep.episodeNumber}
                          onClick={() => onWatch(movie, selectedSeason, ep.episodeNumber)}
                          className="group relative flex items-center gap-3 bg-night-800 border border-zinc-800/80 p-2 rounded cursor-pointer hover:bg-zinc-800 transition-colors"
                        >
                          <div className="w-24 aspect-video bg-zinc-900 rounded overflow-hidden relative shrink-0">
                            {ep.stillUrl ? (
                              <img src={ep.stillUrl} alt={ep.name} className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-700"><Tv className="w-6 h-6" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <PlayCircle className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                            {ep.runtime && (
                              <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] text-zinc-300 font-mono">
                                {ep.runtime}m
                              </div>
                            )}
                          </div>
                          <div className="flex-1 overflow-hidden pr-2">
                            <h4 className="text-xs font-bold text-zinc-200 truncate group-hover:text-brand-400 transition-colors">
                              {ep.episodeNumber}. {ep.name}
                            </h4>
                            <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5 leading-snug">
                              {ep.overview || 'Sinopsis belum tersedia.'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Comments & Discussion */}
              <div className="mt-10 pt-6 border-t border-zinc-800">
                <CommentsSection movieId={movie.id} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* TV Stream Helper Modal */}
      {showTvModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            e.stopPropagation();
            setShowTvModal(false);
          }}
        >
          <div
            className="bg-night-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-brand-500">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Nonton di Layar Smart TV</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Buka browser di Smart TV Anda (mis. Chrome, WebOS Browser, Silk, Safari) lalu masukkan tautan langsung di bawah ini:
            </p>
            <div className="p-3 bg-night-800 rounded border border-zinc-700 select-all font-mono text-xs text-brand-400 font-bold break-all">
              {window.location.origin}/?watch={movie.id}
            </div>
            <div className="flex flex-col gap-2 text-[11px] text-zinc-500 text-left bg-night-800/40 p-3 rounded border border-zinc-800">
              <p>💡 <b className="text-zinc-400">Tips Chromecast / AirPlay:</b> Putar video lalu klik ikon AirPlay / Cast bawaan browser di pojok player.</p>
              <p>💡 Pastikan HP & Smart TV berada di jaringan Wi-Fi yang sama.</p>
            </div>
            <button
              onClick={() => setShowTvModal(false)}
              className="w-full py-2.5 rounded bg-zinc-100 text-zinc-950 font-bold text-xs hover:bg-white transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

    </div>
  );
}