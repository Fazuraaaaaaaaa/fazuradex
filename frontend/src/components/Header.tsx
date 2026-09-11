import { Search, Clapperboard, History, Flame, Sparkles, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  watchHistoryCount: number;
  onOpenHistory: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  watchHistoryCount,
  onOpenHistory,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#0d0d11]/90 backdrop-blur-md border-b border-white/5 py-3 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <div 
            onClick={() => onTabChange('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-600/20 group-hover:scale-105 transition-transform">
              <Clapperboard className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1 leading-none">
                Fazura<span className="text-red-500">Dex</span>
              </span>
              <span className="text-[9px] text-zinc-400 font-medium tracking-widest uppercase">
                Cinema & Series
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onTabChange('home')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'home'
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => onTabChange('ongoing')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'ongoing'
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              Sedang Tayang
            </button>
            <button
              onClick={() => onTabChange('top_rated')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'top_rated'
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Completed & Top
            </button>
            <button
              onClick={() => onTabChange('anime')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'anime'
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Anime
            </button>
          </nav>
        </div>

        {/* Right Section: Search & History */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative w-44 sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 group-focus-within:text-zinc-200 transition-colors" />
            <input
              type="text"
              placeholder="Cari anime, film, drakor..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#16161f] border border-white/10 hover:border-white/20 rounded-full py-1.5 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-all font-sans"
            />
          </div>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16161f] hover:bg-[#1f1f2e] border border-white/10 text-xs font-semibold text-zinc-300 transition-all relative"
            title="Riwayat Tontonan"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Riwayat</span>
            {watchHistoryCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-bold">
                {watchHistoryCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

