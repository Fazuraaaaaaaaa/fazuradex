const providers = [
  'https://vidsrc.cc/v2/embed/movie/550',
  'https://vidsrc.to/embed/movie/550',
  'https://v3.vidsrc.video/embed/movie/550',
  'https://www.2embed.cc/embed/550',
  'https://embed.su/embed/movie/550',
  'https://vidlink.pro/movie/550',
  'https://player.videasy.net/movie/550',
  'https://multiembed.mov/?video_id=tt0137523&tmdb=1',
  'https://superembed.stream/movie/tt0137523',
  'https://player.flixier.io/embed/movie/550',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function run() {
  for (const url of providers) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': UA, Referer: 'http://localhost:5173/' },
        signal: AbortSignal.timeout(15000),
      });
      const body = await res.text();
      const looksPlayer = /<video|jwplayer|hls\.js|player|embed|sources/i.test(body);
      console.log(
        `${String(res.status).padEnd(4)} ${looksPlayer ? 'PLAYER-LIKE' : 'no-player '} ${String(body.length).padStart(8)}b  ${Date.now() - t0}ms  ${url}`,
      );
    } catch (e) {
      console.log(`ERR  ${String((e as Error).message).slice(0, 70).padEnd(74)} ${url}`);
    }
  }
}

run();
