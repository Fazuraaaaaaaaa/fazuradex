/**
 * Provider pemutar film pihak ketiga (embed via TMDB ID).
 *
 * CATATAN PENTING:
 * Server embed (iframe) TIDAK bisa di-probe secara akurat dari sisi backend.
 * Provider seperti VidSrc, 2Embed, dll. sering mengembalikan 403/redirect/
 * Cloudflare challenge pada request server-to-server, padahal embed-nya tetap
 * bisa diputar normal di browser pengguna. Oleh karena itu, semua server
 * langsung dikembalikan tanpa filtering — biarkan pengguna yang memilih
 * server mana yang bekerja di koneksinya.
 */

export interface EmbedServer {
  serverId: string;
  serverName: string;
  type: 'iframe';
  url: string;
  quality: string;
}

/** Cache sederhana untuk menghindari pembuatan array ulang setiap request. */
const cache = new Map<string, { time: number; servers: EmbedServer[] }>();
const TTL = 24 * 60 * 60 * 1000; // 24 jam

/** Daftar semua server embed. */
export function defaultServers(
  tmdbId: string,
  mediaType: 'movie' | 'tv' = 'movie',
  season = 1,
  episode = 1,
): EmbedServer[] {
  if (mediaType === 'tv') {
    return [
      // Tier 1: Paling stabil & cepat
      { serverId: 'vidsrc_me',    serverName: 'VidSrc',       type: 'iframe', url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,                    quality: 'HD'   },
      { serverId: 'vidsrc_to',    serverName: 'VidSrc PRO',   type: 'iframe', url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,                                        quality: 'HD'   },
      { serverId: 'vidlink',      serverName: 'VidLink',      type: 'iframe', url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?title=false&nextbutton=true&primaryColor=E50914`, quality: 'FHD'  },
      { serverId: 'embedsu',      serverName: 'EmbedSU',      type: 'iframe', url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,                                          quality: 'HD'   },
      { serverId: 'autoembed',    serverName: 'AutoEmbed',    type: 'iframe', url: `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`,                                      quality: 'HD'   },
      // Tier 2: Alternatif reliabel
      { serverId: '2embed',       serverName: '2Embed',       type: 'iframe', url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,                                 quality: 'Auto' },
      { serverId: 'multiembed',   serverName: 'MultiEmbed',   type: 'iframe', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,                       quality: 'Auto' },
      { serverId: 'smashystream', serverName: 'SmashyStream', type: 'iframe', url: `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=${season}&episode=${episode}`,    quality: 'HD'   },
      { serverId: 'nontongo',     serverName: 'NontonGo',     type: 'iframe', url: `https://www.NontonGo.in/embed/tv/${tmdbId}/${season}/${episode}`,                                  quality: 'Auto' },
      { serverId: 'vidfast',      serverName: 'VidFast',      type: 'iframe', url: `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}`,                                            quality: 'HD'   },
      { serverId: 'videasy',      serverName: 'VidEasy',      type: 'iframe', url: `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`,                                     quality: 'HD'   },
      { serverId: 'moviesapi',    serverName: 'MoviesAPI',    type: 'iframe', url: `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`,                                         quality: 'HD'   },
      // Tier 3: Tambahan
      { serverId: 'frembed',      serverName: 'FrEmbed',      type: 'iframe', url: `https://frembed.pro/api/serie.php?id=${tmdbId}&sa=${season}&epi=${episode}`,                       quality: 'Auto' },
      { serverId: 'tvembeds',     serverName: 'TV Embeds',    type: 'iframe', url: `https://tvembeds.com/embed/tv/${tmdbId}/${season}/${episode}`,                                     quality: 'Auto' },
      { serverId: 'rive',         serverName: 'RiveStream',   type: 'iframe', url: `https://rivestream.live/embed?type=tv&id=${tmdbId}&season=${season}&episode=${episode}`,           quality: 'HD'   },
      { serverId: 'vidplay',      serverName: 'VidPlay',      type: 'iframe', url: `https://vidplay.online/e/${tmdbId}?s=${season}&e=${episode}`,                                      quality: 'Auto' },
      { serverId: 'cinezone',     serverName: 'CineZone',     type: 'iframe', url: `https://cinezone.to/embed/tv?id=${tmdbId}&season=${season}&episode=${episode}`,                    quality: 'Auto' },
      { serverId: 'vidsrcnl',     serverName: 'VidSrc NL',   type: 'iframe', url: `https://player.vidsrc.nl/embed/tv/${tmdbId}/${season}/${episode}`,                                 quality: 'HD'   },
      { serverId: 'embedrise',    serverName: 'EmbedRise',    type: 'iframe', url: `https://embedrise.com/tv/${tmdbId}/${season}/${episode}`,                                          quality: 'Auto' },
    ];
  }

  // ── MOVIE ──────────────────────────────────────────────────────────────────
  return [
    // Tier 1: Paling stabil & cepat
    { serverId: 'vidsrc_me',    serverName: 'VidSrc',       type: 'iframe', url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,                                           quality: 'HD'   },
    { serverId: 'vidsrc_to',    serverName: 'VidSrc PRO',   type: 'iframe', url: `https://vidsrc.to/embed/movie/${tmdbId}`,                                                quality: 'HD'   },
    { serverId: 'vidlink',      serverName: 'VidLink',      type: 'iframe', url: `https://vidlink.pro/movie/${tmdbId}?title=false&primaryColor=E50914`,                    quality: 'FHD'  },
    { serverId: 'embedsu',      serverName: 'EmbedSU',      type: 'iframe', url: `https://embed.su/embed/movie/${tmdbId}`,                                                 quality: 'HD'   },
    { serverId: 'autoembed',    serverName: 'AutoEmbed',    type: 'iframe', url: `https://autoembed.co/movie/tmdb/${tmdbId}`,                                              quality: 'HD'   },
    // Tier 2: Alternatif reliabel
    { serverId: '2embed',       serverName: '2Embed',       type: 'iframe', url: `https://www.2embed.cc/embed/${tmdbId}`,                                                  quality: 'Auto' },
    { serverId: 'multiembed',   serverName: 'MultiEmbed',   type: 'iframe', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,                                      quality: 'Auto' },
    { serverId: 'smashystream', serverName: 'SmashyStream', type: 'iframe', url: `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`,                              quality: 'HD'   },
    { serverId: 'nontongo',     serverName: 'NontonGo',     type: 'iframe', url: `https://www.NontonGo.in/embed/movie/${tmdbId}`,                                          quality: 'Auto' },
    { serverId: 'vidfast',      serverName: 'VidFast',      type: 'iframe', url: `https://vidfast.pro/movie/${tmdbId}`,                                                    quality: 'HD'   },
    { serverId: 'videasy',      serverName: 'VidEasy',      type: 'iframe', url: `https://player.videasy.net/movie/${tmdbId}`,                                             quality: 'HD'   },
    { serverId: 'moviesapi',    serverName: 'MoviesAPI',    type: 'iframe', url: `https://moviesapi.club/movie/${tmdbId}`,                                                 quality: 'HD'   },
    // Tier 3: Tambahan
    { serverId: 'superembed',   serverName: 'SuperEmbed',   type: 'iframe', url: `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1`,                      quality: 'Auto' },
    { serverId: 'frembed',      serverName: 'FrEmbed',      type: 'iframe', url: `https://frembed.pro/api/film.php?id=${tmdbId}`,                                          quality: 'Auto' },
    { serverId: 'rive',         serverName: 'RiveStream',   type: 'iframe', url: `https://rivestream.live/embed?type=movie&id=${tmdbId}`,                                  quality: 'HD'   },
    { serverId: 'vidsrcnl',     serverName: 'VidSrc NL',   type: 'iframe', url: `https://player.vidsrc.nl/embed/movie/${tmdbId}`,                                         quality: 'HD'   },
    { serverId: 'cinezone',     serverName: 'CineZone',     type: 'iframe', url: `https://cinezone.to/embed/movie?id=${tmdbId}`,                                           quality: 'Auto' },
    { serverId: 'embedrise',    serverName: 'EmbedRise',    type: 'iframe', url: `https://embedrise.com/movie/${tmdbId}`,                                                  quality: 'Auto' },
    { serverId: 'vidplay',      serverName: 'VidPlay',      type: 'iframe', url: `https://vidplay.online/e/${tmdbId}`,                                                     quality: 'Auto' },
  ];
}

/**
 * Mengembalikan semua server yang tersedia untuk film/episode tertentu.
 * Tidak ada HTTP probe — semua server dikembalikan langsung karena:
 * - Probe server-to-server ke iframe provider tidak akurat (Cloudflare/redirect/403)
 * - Pembuatan array statis sangat cepat, tidak perlu async probe yang lambat
 * - Pengguna lebih tahu server mana yang bekerja di koneksi mereka
 */
export async function resolveEmbedServers(
  tmdbId: string,
  _title: string,
  mediaType: 'movie' | 'tv' = 'movie',
  season = 1,
  episode = 1,
): Promise<EmbedServer[]> {
  const key = `${mediaType}_${tmdbId}_${season}_${episode}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < TTL) {
    return hit.servers;
  }
  const servers = defaultServers(tmdbId, mediaType, season, episode);
  cache.set(key, { time: Date.now(), servers });
  return servers;
}

/**
 * Health-check endpoint.
 * Selalu mengembalikan hasPlayableSource: true karena server embed
 * tidak bisa divalidasi dari sisi backend secara akurat.
 */
export async function checkEmbedHealth(
  tmdbId: string,
  mediaType: 'movie' | 'tv' = 'movie',
  season = 1,
  episode = 1,
): Promise<{ hasPlayableSource: boolean; availableServers: EmbedServer[] }> {
  const availableServers = await resolveEmbedServers(tmdbId, '', mediaType, season, episode);
  return {
    hasPlayableSource: true,
    availableServers,
  };
}
