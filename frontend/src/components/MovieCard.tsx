import { memo, useState } from 'react';
import { Star, Play, Info, Film } from 'lucide-react';
import type { Movie } from './MovieModal';

interface MovieCardProps {
  movie: Movie;
  index: number;
  onClick: () => void;
  onDetail: () => void;
}

export const MovieCard = memo(function MovieCard({ movie, index, onClick, onDetail }: MovieCardProps) {
  const [imgError, setImgError] = useState(false);
  const yearMatch = movie.releaseDate?.match(/(19|20)\d{2}/);
  const releaseYear = yearMatch ? yearMatch[0] : (movie.releaseDate || '');

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col gap-2 cursor-pointer select-none"
      style={{ animationDelay: `${(index % 12) * 40}ms` }}
    >
      {/* Poster Box */}
      <div className="relative aspect-[3/4.2] rounded-xl overflow-hidden bg-[#16161f] border border-white/5 shadow-md transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-xl group-hover:shadow-red-500/10 group-hover:border-red-500/40">
        {movie.posterUrl && !imgError ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-night-800">
            <Film size={36} className="text-zinc-600 mb-1" />
            <span className="text-[10px] text-zinc-500 px-2 text-center line-clamp-1">{movie.title}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
          {/* Quality / Type Badge */}
          <span className="bg-red-600/90 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider backdrop-blur-sm">
            {movie.mediaType === 'tv' ? 'TV' : 'HD'}
          </span>

          {/* Rating Badge */}
          {(movie.ratingValue ?? 0) > 0 && (
            <div className="bg-[#0b0b12]/80 backdrop-blur-md px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/10 text-[10px] font-bold text-amber-400">
              <Star className="w-2.5 h-2.5 fill-amber-400" />
              <span>{movie.ratingValue?.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Info / Sinopsis Button (Visible on mobile touch, hover on desktop) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDetail();
          }}
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/20 transition-all opacity-90 md:opacity-0 md:group-hover:opacity-100 z-20 shadow-lg"
          title="Detail Film & Sinopsis"
          aria-label="Detail Film & Sinopsis"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* Play Overlay Button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform pl-0.5">
            <Play className="w-4 h-4 fill-white" />
          </div>
        </div>
      </div>

      {/* Info Section - Tapping title opens details */}
      <div
        className="flex flex-col gap-0.5 px-0.5"
        onClick={(e) => {
          e.stopPropagation();
          onDetail();
        }}
      >
        <h3
          className="font-bold text-xs sm:text-sm text-zinc-200 leading-snug line-clamp-2 group-hover:text-red-400 transition-colors"
          title={movie.title}
        >
          {movie.title}
        </h3>
        <div className="flex items-center text-[10px] sm:text-[11px] text-zinc-400 font-medium tracking-tight truncate">
          {releaseYear && <span>{releaseYear}</span>}
          {movie.genres && movie.genres.length > 0 && (
            <>
              {releaseYear && <span className="mx-1.5 opacity-30">•</span>}
              <span className="truncate">{movie.genres[0]}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
