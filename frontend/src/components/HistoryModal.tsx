import { X, Trash2, Play, Film, Clock } from 'lucide-react';
import type { Movie } from './MovieModal';

interface HistoryModalProps {
  history: Movie[];
  onClose: () => void;
  onWatch: (movie: Movie) => void;
  onClearAll: () => void;
  onRemoveItem: (id: string) => void;
}

export function HistoryModal({
  history,
  onClose,
  onWatch,
  onClearAll,
  onRemoveItem,
}: HistoryModalProps) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#12121a] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#181824] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Riwayat Tontonan</h2>
              <p className="text-xs text-zinc-400">{history.length} film/serial terakhir</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors border border-red-500/20"
                title="Hapus Semua Riwayat"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hapus Semua</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 hide-scrollbar">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 mb-4">
                <Film className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Belum Ada Riwayat</h3>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Film atau serial yang kamu putar akan otomatis tersimpan di sini agar kamu bisa lanjut menonton kapan saja!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {history.map((m) => (
                <div
                  key={m.id}
                  className="group relative flex items-center gap-3 bg-[#181824]/60 hover:bg-[#1f1f2e] border border-white/5 hover:border-white/10 rounded-xl p-2.5 transition-all"
                >
                  <div
                    onClick={() => { onClose(); onWatch(m); }}
                    className="relative w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-black/40 cursor-pointer shadow-md"
                  >
                    {m.posterUrl ? (
                      <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                        <Film className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                      <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4
                      onClick={() => { onClose(); onWatch(m); }}
                      className="text-xs sm:text-sm font-bold text-white truncate cursor-pointer hover:text-red-400 transition-colors"
                      title={m.title}
                    >
                      {m.title}
                    </h4>
                    <span className="text-[10px] text-zinc-400 mt-0.5">
                      {m.releaseDate
                        ? (m.releaseDate.match(/\d{4}/)?.[0] ?? m.releaseDate)
                        : 'Film'} • {' '}
                      {m.mediaType === 'tv' ? 'Serial TV' : 'Film'}
                    </span>
                    <button
                      onClick={() => { onClose(); onWatch(m); }}
                      className="mt-2 text-[11px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 w-fit"
                    >
                      <Play className="w-3 h-3 fill-current" /> Lanjut Nonton
                    </button>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveItem(m.id); }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors self-start"
                    title="Hapus dari riwayat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

