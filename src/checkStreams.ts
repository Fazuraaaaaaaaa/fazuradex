import axios from 'axios';

const CANDIDATES = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  'https://test-streams.mux.dev/pts_shift/master.m3u8',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
];

async function check(url: string) {
  try {
    const res = await axios.get(url, { timeout: 15000, maxContentLength: 2_000_000 });
    const body = typeof res.data === 'string' ? res.data : '(binary)';
    const variants = (body.match(/#EXT-X-STREAM-INF/g) ?? []).length;
    const cors = res.headers['access-control-allow-origin'] ?? '-';
    const ctype = res.headers['content-type'] ?? '-';
    console.log(`OK   ${url}`);
    console.log(`     status=${res.status} type=${ctype} cors=${cors} variants=${variants} bytes=${body.length}`);
  } catch (err) {
    const e = err as { response?: { status?: number }; message?: string };
    console.log(`FAIL ${url}`);
    console.log(`     ${e.response?.status ?? ''} ${e.message ?? err}`);
  }
}

(async () => {
  for (const url of CANDIDATES) await check(url);
})();
