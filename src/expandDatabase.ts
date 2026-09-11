import 'dotenv/config';
import * as path from 'path';
import { syncCatalog, FULL_SOURCES } from './syncCatalog';

const DATA_FILE = path.resolve(__dirname, '../output/movies.json');

async function main() {
  console.log('='.repeat(60));
  console.log('🎬 EXPAND MOVIE DATABASE TO MAXIMUM CAPACITY (TMDB API) 🎬');
  console.log('='.repeat(60));
  const started = Date.now();
  const stats = await syncCatalog(FULL_SOURCES, DATA_FILE);
  console.log('='.repeat(60));
  console.log(`🎉 SELESAI dalam ${((Date.now() - started) / 1000).toFixed(1)} detik`);
  console.log(`   • Film terambil : ${stats.fetched}`);
  console.log(`   • Film baru     : +${stats.added}`);
  console.log(`   • Diperbarui    : ~${stats.updated}`);
  console.log(`   • Total katalog : ${stats.total} film`);
  console.log(`💾 Database: ${DATA_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

