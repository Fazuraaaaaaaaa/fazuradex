import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  MonitorPlay,

  ChevronLeft,
  ChevronRight,
  ListVideo,
} from 'lucide-react';

export interface StreamItem {
  serverId: string;
  serverName: string;
  type: 'youtube' | 'hls' | 'mp4' | 'iframe';
  url: string;
  quality: string;
}

export interface PlayingMovie {
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

interface VideoPlayerProps {
  movie: PlayingMovie;
  onClose: () => void;
  onNextEpisode?: () => void;
}

function parseYouTubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

const SERVER_RENAME_MAP: Record<string, string> = {
  'vidlink': 'vidlinkultrahd',
  'vidsrc': 'vidsrcpro',
  'vidsrcpro': 'vidsrcpro',
  'embedsu': 'embedsufast',
  'vidsrc_me': 'vidsrcme',
  'vidsrcme': 'vidsrcme',
  'autoembed': 'autoembed',
  '2embed': '2embedcinema',
  'vidfast': 'vidfaststream',
  'vidfaststream': 'vidfaststream',
  'videasy': 'videasyhd',
  'videasyhd': 'videasyhd',
};

const SERVER_ORDER = [
  'vidlink',
  'vidsrc',
  'vidsrcpro',
  'embedsu',
  'vidsrc_me',
  'vidsrcme',
  'autoembed',
  '2embed',
  'vidfast',
  'vidfaststream',
  'videasy',
  'videasyhd',
];

export function VideoPlayer({ movie, onClose, onNextEpisode }: VideoPlayerProps) {
  const safeStreams = movie.streams && movie.streams.length > 0 ? movie.streams : [{
    serverId: 'fallback',
    serverName: 'Fallback Server',
    type: 'hls' as const,
    url: movie.streamUrl,
    quality: 'Auto',
  }];
  
  const orderedStreams = [...safeStreams].sort((a, b) => {
    const idxA = SERVER_ORDER.indexOf(a.serverId);
    const idxB = SERVER_ORDER.indexOf(b.serverId);
    const orderA = idxA !== -1 ? idxA : 999;
    const orderB = idxB !== -1 ? idxB : 999;
    return orderA - orderB;
  });

  const sortedStreams = [...orderedStreams].sort((a, b) => {
    const pref = localStorage.getItem('pref_server');
    if (a.serverId === pref) return -1;
    if (b.serverId === pref) return 1;
    return 0;
  });const [server, setServer] = useState<StreamItem>(sortedStreams[0]);

  useEffect(() => {
    try {
      const histStr = localStorage.getItem('watch_history');
      let hist: PlayingMovie[] = histStr ? JSON.parse(histStr) : [];
      hist = hist.filter(m => m.id !== movie.id);
      hist.unshift(movie);
      if (hist.length > 10) hist = hist.slice(0, 10);
      localStorage.setItem('watch_history', JSON.stringify(hist));
    } catch (e) {
      console.error(e);
    }
  }, [movie.id]);

  useEffect(() => {
    localStorage.setItem('pref_server', server.serverId);
  }, [server.serverId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isBufferingVideo, setIsBufferingVideo] = useState(false);
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<{ height: number; index: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<number | null>(null);
  const recoverAttempts = useRef(0);

  const isYoutube = server.type === 'youtube';
  const isIframe = server.type === 'iframe';

  /* ===== HLS ENGINE ===== */
  useEffect(() => {
    if (isYoutube || isIframe) {
      if (isIframe) {
        setIframeLoading(true);
        const timer = setTimeout(() => setIframeLoading(false), 4000);
        return () => clearTimeout(timer);
      }
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    setErrorMsg(null);
    setQualities([]);
    setCurrentQuality(-1);
    setIsBuffering(true);
    setIsBufferingVideo(false);
    setNeedsManualPlay(false);
    recoverAttempts.current = 0;

    const saved = Number(localStorage.getItem('pos_' + movie.id) ?? '0');

    const startPlay = () => {
      video
        .play()
        .then(() => setNeedsManualPlay(false))
        .catch(() => {
          setNeedsManualPlay(true);
          setIsBuffering(false);
        });
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 4,
      });
      hlsRef.current = hls;
      hls.loadSource(server.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setIsBuffering(false);
        const levels = data.levels
          .map((lvl, index) => ({ height: lvl.height || 0, index }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setQualities(levels);
        if (saved > 10) video.currentTime = saved;
        startPlay();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentQuality(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.FRAG_LOADING, () => setIsBufferingVideo(true));
      hls.on(Hls.Events.FRAG_LOADED, () => setIsBufferingVideo(false));

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (recoverAttempts.current < 2) {
          recoverAttempts.current += 1;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else {
            hls.destroy();
            startPlay();
          }
          return;
        }
        setIsBuffering(false);
        setIsBufferingVideo(false);
        setErrorMsg('Server ' + server.serverName + ' gangguan. Pilih server lain di bawah.');
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = server.url;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        if (saved > 10) video.currentTime = saved;
        startPlay();
      });
    } else {
      setIsBuffering(false);
      setErrorMsg('Browser ini tidak mendukung HLS.');
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [server.url, server.type, movie.id, isYoutube]);

  /* ===== SIMPAN POSISI TONTONAN ===== */
  useEffect(() => {
    if (isYoutube) return;
    const interval = window.setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        localStorage.setItem('pos_' + movie.id, videoRef.current.currentTime.toString());
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [movie.id, isYoutube]);

  const [skipAlert, setSkipAlert] = useState<string | null>(null);
  const skipAlertTimer = useRef<number | null>(null);

  const wakeControls = () => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (isYoutube || isIframe || (videoRef.current && !videoRef.current.paused)) {
        setShowControls(false);
        setShowSettings(false);
      }
    }, 3500);
  };

  useEffect(() => {
    wakeControls();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [isPlaying, isYoutube, isIframe]);

  const togglePlay = () => {
    if (isYoutube || isIframe) return;
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  };

  const skip = (amount: number) => {
    if (isYoutube || isIframe) return;
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
      setSkipAlert(amount > 0 ? '+10s' : '-10s');
      if (skipAlertTimer.current) window.clearTimeout(skipAlertTimer.current);
      skipAlertTimer.current = window.setTimeout(() => setSkipAlert(null), 750);
      wakeControls();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const setQuality = (index: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index);
    }
    setShowSettings(false);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isYoutube || isIframe) return;
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-10); }
      else if (e.key.toLowerCase() === 'm') {
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
        }
      }
      else if (e.key.toLowerCase() === 'f') { toggleFullscreen(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isYoutube, isIframe]);

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec
      : m + ':' + (sec < 10 ? '0' : '') + sec;
  };

  const ytId = isYoutube ? parseYouTubeId(server.url) : null;
  const isTv = movie.mediaType === 'tv';

  return (
    <div className="fixed inset-0 z-[100] bg-[#0d0d11] overflow-y-auto font-sans hide-scrollbar">
      
      {/* HEADER TOP BAR */}
      <div className="w-full bg-[#16161f] border-b border-white/5 sticky top-0 z-50 px-4 md:px-8 py-3 flex items-center justify-between shadow-md">
        <button onClick={onClose} className="flex items-center gap-2 text-zinc-400 hover:text-white font-medium text-sm transition-colors group">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden sm:inline">Kembali</span>
        </button>
        <span className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md md:max-w-xl lg:max-w-3xl text-center px-4">
          {movie.title}
        </span>
        <div className="w-10 sm:w-20"></div>
      </div>

      {/* PLAYER WRAPPER */}
      <div className="w-full bg-[#09090b] flex justify-center border-b border-zinc-800/80">
        <div 
          ref={containerRef}
          onMouseMove={wakeControls}
          className="relative w-full md:w-[90%] lg:w-[85%] max-w-[1400px] aspect-video bg-black flex flex-col items-center justify-center select-none overflow-hidden md:my-4 lg:my-6 md:rounded-xl shadow-2xl ring-1 ring-white/10"
        >
          {movie.posterUrl && (
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden flex items-center justify-center">
              <img src={movie.posterUrl} alt="ambient" className="w-full h-[150%] object-cover blur-[80px] brightness-50" />
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md px-6 text-center">
              <AlertTriangle className="w-16 h-16 text-brand-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
              <h2 className="text-xl font-bold text-white mb-2">Streaming Terputus</h2>
              <p className="text-gray-300 max-w-md">{errorMsg}</p>
            </div>
          )}

          {needsManualPlay && !errorMsg && !isYoutube && !isIframe && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <button onClick={togglePlay} className="w-24 h-24 rounded-full bg-brand-500/90 text-white flex items-center justify-center hover:bg-brand-400 hover:scale-110 transition-all shadow-[0_0_40px_rgba(239,68,68,0.5)]">
                <Play className="w-12 h-12 ml-2" />
              </button>
            </div>
          )}

          {(isBuffering || isBufferingVideo || iframeLoading) && !needsManualPlay && !errorMsg && !isYoutube && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <div className="w-16 h-16 border-[5px] border-white/20 border-t-brand-500 rounded-full animate-spin shadow-2xl drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
            </div>
          )}

          {skipAlert && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
              <div className="px-6 py-3 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 text-white text-2xl font-black tracking-wide shadow-[0_0_30px_rgba(239,68,68,0.35)] animate-[skipPop_0.75s_ease-out_forwards]">{skipAlert}</div>
            </div>
          )}

          {!isYoutube && !isIframe && showControls && !errorMsg && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-gray-300">
              <span className="text-brand-400">??</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">?</kbd> mundur 10s</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">?</kbd> maju 10s</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Space</kbd> play/pause</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">M</kbd> mute</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">F</kbd> fullscreen</span>
            </div>
          )}

          <div className="relative w-full h-full z-10 flex items-center justify-center bg-black overflow-hidden group">
            {isYoutube && ytId ? (
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-none"
              />
            ) : isIframe ? (
              <iframe
                src={server.url}
                title={movie.title}
                className={`w-full h-full border-none transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                onLoad={() => setIframeLoading(false)}
              />
            ) : (
              <video
                ref={videoRef}
                poster={movie.posterUrl}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }}
                onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
                onProgress={() => { const v = videoRef.current; if (v && v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1)); }}
              />
            )}

            {!isYoutube && !isIframe && (
              <>
                <div className="absolute left-0 top-0 h-full w-1/4 cursor-pointer" title="Klik 2x = mundur 10 detik" onClick={togglePlay} onDoubleClick={(e) => { e.preventDefault(); skip(-10); }} />
                <div className="absolute right-0 top-0 h-full w-1/4 cursor-pointer" title="Klik 2x = maju 10 detik" onClick={togglePlay} onDoubleClick={(e) => { e.preventDefault(); skip(10); }} />
              </>
            )}
          </div>

          {!isYoutube && !isIframe && (
            <div className={'absolute bottom-0 left-0 right-0 px-6 py-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-4 z-30 transition-opacity duration-500 ' + (showControls ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
              <div className="flex items-center gap-4 w-full group/progress">
                <span className="text-xs font-bold text-gray-200 min-w-[48px] text-right drop-shadow">{fmt(currentTime)}</span>
                <div className="relative flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer group-hover/progress:h-2.5 transition-all overflow-hidden flex items-center">
                  <div className="absolute top-0 bottom-0 left-0 bg-white/40 rounded-full transition-all" style={{ width: (duration > 0 ? (buffered / duration) * 100 : 0) + '%' }} />
                  <input type="range" min={0} max={duration || 100} value={currentTime} onChange={(e) => { const t = parseFloat(e.target.value); setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t; }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                  <div className="absolute top-0 bottom-0 left-0 bg-brand-500 rounded-full z-10 shadow-[0_0_10px_rgba(239,68,68,0.8)] pointer-events-none transition-all duration-75" style={{ width: (duration > 0 ? (currentTime / duration) * 100 : 0) + '%' }} />
                </div>
                <span className="text-xs font-bold text-gray-400 min-w-[48px] drop-shadow">{fmt(duration)}</span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-6">
                  <button onClick={togglePlay} className="text-white hover:text-brand-400 transition-all hover:scale-110 active:scale-95">
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current" />}
                  </button>
                  <button onClick={() => skip(-10)} className="text-gray-300 hover:text-white transition-colors"><RotateCcw className="w-5 h-5" /></button>
                  <button onClick={() => skip(10)} className="text-gray-300 hover:text-white transition-colors"><RotateCw className="w-5 h-5" /></button>
                  <div className="flex items-center gap-3 group/vol ml-2">
                    <button onClick={() => { if (!videoRef.current) return; videoRef.current.muted = !videoRef.current.muted; setIsMuted(videoRef.current.muted); }} className="text-white hover:text-brand-400 transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; setIsMuted(v === 0); } }} className="w-0 group-hover/vol:w-20 opacity-0 group-hover/vol:opacity-100 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-brand-500 transition-all duration-300" />
                  </div>
                </div>

                <div className="flex items-center gap-4 relative">
                  <button onClick={() => setShowSettings((s) => !s)} className="text-white hover:text-brand-400 flex items-center gap-2 text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur transition-all">
                    <Settings className="w-4 h-4" />
                    <span>{currentQuality === -1 ? 'Auto' : (qualities.find((q) => q.index === currentQuality)?.height ?? '') + 'p'}</span>
                  </button>

                  {showSettings && (
                    <div className="absolute bottom-12 right-10 bg-night-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 min-w-[120px] shadow-2xl flex flex-col gap-1 z-40">
                      <span className="text-[10px] font-black text-gray-500 px-3 py-1 uppercase tracking-widest border-b border-white/10 mb-1">Quality</span>
                      <button onClick={() => setQuality(-1)} className={'text-left text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ' + (currentQuality === -1 ? 'bg-brand-500 text-white' : 'text-gray-300 hover:bg-white/10')}>Auto</button>
                      {qualities.map((q) => (
                        <button key={q.index} onClick={() => setQuality(q.index)} className={'text-left text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ' + (currentQuality === q.index ? 'bg-brand-500 text-white' : 'text-gray-300 hover:bg-white/10')}>{q.height}p</button>
                      ))}
                    </div>
                  )}

                  <button onClick={toggleFullscreen} className="text-white hover:text-brand-400 transition-transform hover:scale-110">
                    {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WATCH PAGE CONTENT (Servers & Downloads) */}
      <div className="w-full max-w-5xl mx-auto px-4 py-6 md:py-8 flex flex-col gap-6 md:gap-8 pb-20">
        
        {/* TITLE ROW */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-white leading-snug max-w-3xl">
            {movie.title}
            {isTv && movie.season && movie.episode && ` Season ${movie.season} Episode ${movie.episode}`}
            {' '}<span className="text-zinc-500 font-medium">Subtitle Indonesia</span>
          </h1>
          
          <div className="flex items-center flex-wrap gap-2 md:gap-3 shrink-0">
            <button className="flex items-center gap-2 bg-[#1b1b23] border border-zinc-800 hover:bg-[#252530] text-zinc-300 hover:text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors">
              <ListVideo className="w-4 h-4" /> <span className="hidden sm:inline">Playlist</span>
            </button>
            <button className="flex items-center gap-2 bg-[#1b1b23] border border-zinc-800 hover:bg-[#252530] text-zinc-300 hover:text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors">
              <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Prev</span>
            </button>
            <button onClick={onNextEpisode} disabled={!onNextEpisode} className={`flex items-center gap-2 border px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors ${onNextEpisode ? 'bg-[#1b1b23] border-zinc-800 hover:bg-[#252530] text-zinc-300 hover:text-white' : 'bg-[#0f0f13] border-zinc-900 text-zinc-700 cursor-not-allowed'}`}>
              <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SERVERS SECTION */}
        <div className="bg-[#0f0f13] rounded-2xl border border-zinc-800/60 p-5 md:p-6 shadow-xl mb-10">
          <div className="flex items-center gap-3 mb-6">
            <MonitorPlay className="w-5 h-5 text-violet-500" />
            <h2 className="text-lg font-bold text-white tracking-wide">Servers</h2>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
            {orderedStreams.map((st) => {
              const displayName = SERVER_RENAME_MAP[st.serverId] || st.serverName.toLowerCase().replace(/[^a-z0-9]/g, '');
              return (
                <button
                  key={st.serverId}
                  onClick={() => setServer(st)}
                  className={`px-4 md:px-5 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                    server.serverId === st.serverId
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 font-semibold'
                      : 'bg-[#1b1b23] text-zinc-300 hover:bg-[#252530] hover:text-white'
                  }`}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        </div>

              </div>
    </div>
  );
}

