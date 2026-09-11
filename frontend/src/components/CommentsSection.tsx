import { useState, useEffect } from 'react';
import { MessageSquare, Send, Star, AlertCircle } from 'lucide-react';

interface CommentItem {
  id: string;
  author: string;
  text: string;
  rating?: number;
  isSpoiler?: boolean;
  createdAt: string;
}

export function CommentsSection({ movieId }: { movieId: string }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/movies/${movieId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setComments(data.data);
        }
      })
      .catch(() => {});
  }, [movieId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/movies/${movieId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: author.trim() || 'Penonton',
          text,
          rating: rating > 0 ? rating : undefined,
          isSpoiler,
        }),
      });
      const data = await res.json();
      if (data.data) {
        setComments((prev) => [...prev, data.data]);
        setText('');
        setRating(0);
        setIsSpoiler(false);
      }
    } catch (err) {
      alert('Gagal mengirim ulasan');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSpoiler = (id: string) => {
    setRevealedSpoilers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-zinc-400" />
        <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">
          Diskusi & Ulasan ({comments.length})
        </h3>
      </div>

      {/* Form Input Komentar */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-night-800 border border-zinc-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Nama (opsional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="bg-night-900 border border-zinc-700 text-xs rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 flex-1 min-w-[140px]"
          />

          {/* Star selector */}
          <div className="flex items-center gap-1 bg-night-900 border border-zinc-700 rounded-lg px-2.5 py-1.5">
            <span className="text-[11px] text-zinc-500 mr-1">Skor:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(rating === star ? 0 : star)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    star <= rating ? 'text-gold fill-gold' : 'text-zinc-600'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Spoiler toggle */}
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSpoiler}
              onChange={(e) => setIsSpoiler(e.target.checked)}
              className="rounded bg-night-900 border-zinc-700 text-brand-500 focus:ring-0 cursor-pointer"
            />
            <span>Spoiler</span>
          </label>
        </div>

        <div className="relative">
          <textarea
            rows={2}
            placeholder="Tulis pendapatmu tentang film ini..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-night-900 border border-zinc-700 text-xs rounded-lg p-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="absolute right-2.5 bottom-3 px-3 py-1.5 rounded bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            Kirim
          </button>
        </div>
      </form>

      {/* Daftar Komentar */}
      <div className="flex flex-col gap-3">
        {comments.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">
            Belum ada ulasan. Jadilah yang pertama memberikan review!
          </p>
        ) : (
          [...comments].reverse().map((c) => {
            const isHidden = c.isSpoiler && !revealedSpoilers[c.id];
            return (
              <div
                key={c.id}
                className="bg-night-800/60 border border-zinc-800/80 rounded-lg p-3.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-300">{c.author}</span>
                    {c.rating && (
                      <div className="flex items-center gap-0.5 text-gold">
                        <Star className="w-3 h-3 fill-gold" />
                        <span className="text-[11px] font-semibold">{c.rating}/5</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(c.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {c.isSpoiler && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold uppercase tracking-wider">
                    <AlertCircle className="w-3 h-3" />
                    <span>Mengandung Spoiler</span>
                  </div>
                )}

                <div
                  onClick={() => isHidden && toggleSpoiler(c.id)}
                  className={`text-xs text-zinc-300 leading-relaxed ${
                    isHidden ? 'blur-sm cursor-pointer select-none py-1 bg-night-900/70 rounded px-2' : ''
                  }`}
                >
                  {c.text}
                </div>
                {isHidden && (
                  <button
                    onClick={() => toggleSpoiler(c.id)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 underline text-left w-fit"
                  >
                    Klik untuk menampilkan spoiler
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}