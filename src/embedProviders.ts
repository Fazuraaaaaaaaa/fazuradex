/**
 * Provider pemutar film pihak ketiga (embed via TMDB ID).
 */

export interface EmbedServer {
  serverId: string;
  serverName: string;
  type: 'iframe';
  url: string;
  quality: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT_MS = 2500;
const RESOLVE_BUDGET_MS = 1500;
const TTL_OK = 6 * 60 * 60 * 1000;
const TTL_BAD = 2 * 60 * 1000;

const cache = new Map<string, { time: number; servers: EmbedServer[] }>();

/** Daftar server default (dipakai selama hasil cek belum tersedia). */
export function defaultServers(
  tmdbId: string,
  mediaType: 'movie' | 'tv' = 'movie',
  season = 1,
  episode = 1,
): EmbedServer[] {
  if (mediaType === 'tv') {
    return [
      { serverId: 'vidlink', serverName: 'VidLink (Ultra HD)', type: 'iframe', url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?title=false&nextbutton=true&primaryColor=E50914`, quality: 'Multi-Source' },
      { serverId: 'vidsrc', serverName: 'VidSrc PRO', type: 'iframe', url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`, quality: 'Multi-Source' },
      { serverId: 'embedsu', serverName: 'EmbedSU (Fast)', type: 'iframe', url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`, quality: 'Auto' },
      { serverId: 'vidsrc_me', serverName: 'VidSrc ME', type: 'iframe', url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`, quality: 'Auto' },
      { serverId: 'autoembed', serverName: 'AutoEmbed', type: 'iframe', url: `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`, quality: 'Auto' },
      { serverId: '2embed', serverName: '2Embed Series', type: 'iframe', url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`, quality: 'Auto' },
      { serverId: 'vidfast', serverName: 'VidFast TV', type: 'iframe', url: `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}`, quality: 'Auto' },
      { serverId: 'videasy', serverName: 'VidEasy TV', type: 'iframe', url: `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`, quality: 'Auto' },
    ];
  }

  return [
    { serverId: 'vidlink', serverName: 'VidLink (Ultra HD)', type: 'iframe', url: `https://vidlink.pro/movie/${tmdbId}?title=false&primaryColor=E50914`, quality: 'Multi-Source' },
    { serverId: 'vidsrc', serverName: 'VidSrc PRO', type: 'iframe', url: `https://vidsrc.to/embed/movie/${tmdbId}`, quality: 'Multi-Source' },
    { serverId: 'embedsu', serverName: 'EmbedSU (Fast)', type: 'iframe', url: `https://embed.su/embed/movie/${tmdbId}`, quality: 'Auto' },
    { serverId: 'vidsrc_me', serverName: 'VidSrc ME', type: 'iframe', url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`, quality: 'Auto' },
    { serverId: 'autoembed', serverName: 'AutoEmbed', type: 'iframe', url: `https://autoembed.co/movie/tmdb/${tmdbId}`, quality: 'Auto' },
    { serverId: '2embed', serverName: '2Embed Cinema', type: 'iframe', url: `https://www.2embed.cc/embed/${tmdbId}`, quality: 'Auto' },
    { serverId: 'vidfast', serverName: 'VidFast Stream', type: 'iframe', url: `https://vidfast.pro/movie/${tmdbId}`, quality: 'Auto' },
    { serverId: 'videasy', serverName: 'VidEasy HD', type: 'iframe', url: `https://player.videasy.net/movie/${tmdbId}`, quality: 'Auto' },
  ];
}

export async function resolveEmbedServers(
  tmdbId: string,
  _title: string,
  mediaType: 'movie' | 'tv' = 'movie',
  season = 1,
  episode = 1,
): Promise<EmbedServer[]> {
  const key = `${mediaType}_${tmdbId}_${season}_${episode}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < (hit.servers.length > 0 ? TTL_OK : TTL_BAD)) {
    return hit.servers;
  }

  const def = defaultServers(tmdbId, mediaType, season, episode);
  cache.set(key, { time: Date.now(), servers: def });
  return def;
}
export async function checkEmbedHealth(
  tmdbId: string,
  mediaType: 'movie' | 'tv' = 'movie',
  season = 1,
  episode = 1
): Promise<{ hasPlayableSource: boolean; availableServers: EmbedServer[] }> {
  const servers = defaultServers(tmdbId, mediaType, season, episode);
  
  const probeResults = await Promise.allSettled(
    servers.slice(0, 3).map(async (server) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(server.url, {
          method: 'GET',
          headers: { 'User-Agent': UA },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status !== 404 && res.status !== 502 && res.status !== 504) {
          return server;
        }
        return null;
      } catch {
        return server;
      }
    })
  );

  const availableTop3 = probeResults
    .filter((r): r is PromiseFulfilledResult<EmbedServer | null> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value as EmbedServer);

  const isAll404 = probeResults.every(
    (r) => r.status === 'fulfilled' && r.value === null
  );

  const available = availableTop3.length > 0 ? availableTop3.concat(servers.slice(3)) : (isAll404 ? [] : servers);

  return {
    hasPlayableSource: available.length > 0,
    availableServers: available,
  };
}
