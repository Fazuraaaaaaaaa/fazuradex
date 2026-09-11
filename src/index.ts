import { scrapeMovies } from './scraper';
import { saveToJson, saveToCsv } from './utils';

async function main() {
  console.log('='.repeat(50));
  console.log('🎥 TMDB Movie Scraper (TypeScript) 🎥');
  console.log('='.repeat(50));

  // Anda dapat mengubah opsi di sini
  // pageCount: Berapa halaman "Popular Movies" yang ingin diambil (tiap halaman = 20 film)
  // 50 halaman x 20 film = 1000 film!
  // fetchDetails: Set ke false karena list API TMDB sudah mencakup overview & rating
  const options = {
    pageCount: 50,
    fetchDetails: false,
  };

  try {
    const movies = await scrapeMovies(options);

    if (movies.length === 0) {
      console.log('❌ Tidak ada data yang berhasil diambil.');
      return;
    }

    console.log(`\n✅ Selesai mengambil data! Menyimpan...`);

    const jsonPath = saveToJson('movies.json', movies);
    console.log(`💾 Data JSON tersimpan di: ${jsonPath}`);

    // Siapkan data CSV (meratakan array/object supaya bisa di-export)
    const csvData = movies.map((m) => ({
      id: m.id,
      title: m.title,
      releaseDate: m.releaseDate,
      ratingValue: m.ratingValue ?? '',
      ratingCount: m.ratingCount ?? '',
      genres: m.genres ? m.genres.join(' | ') : '',
      duration: m.duration ?? '',
      url: m.url,
      posterUrl: m.posterUrl,
      description: m.description ? m.description.replace(/\n/g, ' ') : '',
    }));
    const csvPath = saveToCsv('movies.csv', csvData);
    console.log(`📊 Data CSV tersimpan di: ${csvPath}`);

    console.log('\n--- 3 Contoh Data Pertama ---');
    console.log(JSON.stringify(movies.slice(0, 3), null, 2));
  } catch (error) {
    console.error('\n❌ Terjadi error fatal:', error);
  }
}

main();

