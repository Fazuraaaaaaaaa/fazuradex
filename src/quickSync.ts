import 'dotenv/config';
import * as path from 'path';
import { syncCatalog, getQuickSources } from './syncCatalog';

const DATA_FILE = path.resolve(__dirname, '../output/movies.json');
console.log('🔄 Menarik film terbaru (Now Playing, Upcoming, Bioskop ID & Global, Trending)...');
syncCatalog(getQuickSources(), DATA_FILE, { verbose: true })
  .then((stats) => {
    console.log(`✅ Selesai: +${stats.added} baru, ~${stats.updated} diupdate. Total: ${stats.total}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Gagal:', err);
    process.exit(1);
  });
