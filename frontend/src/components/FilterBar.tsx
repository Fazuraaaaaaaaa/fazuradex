interface FilterBarProps {
  genres: string[];
  selectedGenre: string;
  onGenreSelect: (genre: string) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  collection: string;
  onCollectionChange: (collection: string) => void;
}

export function FilterBar({
  genres,
  selectedGenre,
  onGenreSelect,
  sort,
  onSortChange,
  collection,
  onCollectionChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-night-800/80 border border-zinc-800/80 rounded-xl p-3">
      {/* Genre Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar flex-1">
        <button
          onClick={() => onGenreSelect('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            selectedGenre === 'all'
              ? 'bg-zinc-100 text-zinc-950 font-semibold'
              : 'bg-night-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-night-700/60 border border-zinc-800/60'
          }`}
        >
          Semua
        </button>
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => onGenreSelect(g)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedGenre === g
                ? 'bg-zinc-100 text-zinc-950 font-semibold'
                : 'bg-night-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-night-700/60 border border-zinc-800/60'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Dropdown filters */}
      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t border-zinc-800/50 pt-2.5 md:border-0 md:pt-0">
        <select
          value={collection}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="bg-night-900 border border-zinc-800 text-xs rounded-lg py-1.5 px-2.5 focus:border-zinc-500 outline-none text-zinc-200 cursor-pointer font-medium"
        >
          <option value="all">Koleksi: Semua</option>
          <option value="popular">🔥 Terpopuler</option>
          <option value="top_rated">⭐ Top Rating</option>
          <option value="now_playing">🎬 Sedang Tayang</option>
          <option value="upcoming">🗓️ Segera Hadir</option>
          <option value="indonesia">🇮🇩 Film Indonesia</option>
          <option value="anime">✨ Anime & Animasi</option>
          <option value="horror">👻 Horor & Thriller</option>
          <option value="action">⚔️ Action</option>
          <option value="scifi">🛸 Sci-Fi & Fantasy</option>
          <option value="romance">❤️ Romance</option>
        </select>

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="bg-night-900 border border-zinc-800 text-xs rounded-lg py-1.5 px-2.5 focus:border-zinc-500 outline-none text-zinc-300 cursor-pointer font-medium"
        >
          <option value="default">Urut: Relevansi</option>
          <option value="rating_desc">Rating Tertinggi</option>
          <option value="date_desc">Tahun Terbaru</option>
          <option value="date_asc">Tahun Terlama</option>
          <option value="title_asc">Judul (A-Z)</option>
        </select>
      </div>
    </div>
  );
}
