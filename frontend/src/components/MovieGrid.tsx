import { Film } from 'lucide-react';
import type { Movie } from './MovieModal';
import { MovieCard } from './MovieCard';

interface MovieGridProps {
  movies: Movie[];
  loading: boolean;
  onSelect: (movie: Movie) => void;
  onDetail: (movie: Movie) => void;
}

export function MovieGrid({ movies, loading, onSelect, onDetail }: MovieGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded-xl bg-night-800 animate-pulse border border-white/5"
          />
        ))}
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-night-800 rounded-full flex items-center justify-center mb-4">
          <Film className="w-8 h-8 text-gray-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-200">Tidak ada film ditemukan</h3>
        <p className="text-gray-500 mt-2">
          Coba ubah kata kunci pencarian atau filter genre Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 sm:gap-x-6 sm:gap-y-10">
      {movies.map((movie, idx) => (
        <MovieCard key={movie.id} movie={movie} index={idx} onClick={() => onSelect(movie)} onDetail={() => onDetail(movie)} />
      ))}
    </div>
  );
}
