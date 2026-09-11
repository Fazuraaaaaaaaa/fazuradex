# 🎬 FazuraDex — Movie Scraper & Modern Web App (Fullstack TypeScript)

Aplikasi katalog film berbasis scraping **The Movie Database (TMDB)** menggunakan **TypeScript**, didukung antarmuka web modern dengan **React**, **Vite**, dan **Tailwind CSS**.

---

## ✨ Fitur Utama

### 🕷️ Backend & Scraper
- **Scraping Terstruktur**: Mengambil data film populer dari TMDB secara otomatis.
- **Deep Detail Extraction**: Mengambil judul, poster HD, tanggal rilis, durasi, genre, dan rating voting dari data JSON-LD.
- **REST API Lengkap**:
  - `GET /api/movies` : Daftar film + pencarian (`?q=...`), filter genre (`?genre=...`), sorting (`?sort=...`), paginasi.
  - `GET /api/genres` : Daftar genre unik untuk filter.
  - `GET /api/movies/stats` : Statistik katalog (total film, rata-rata rating, jumlah per genre).
  - `GET /api/movies/:id` : Detail film beserta rekomendasi film terkait.
  - `POST /api/refresh` : Trigger scrape ulang film dari web secara langsung.
- **Export Otomatis**: Menyimpan hasil scraping ke `output/movies.json` & `output/movies.csv`.

### 🎨 Frontend (React + Tailwind CSS)
- **Desain Sinematik Modern**: Dark theme premium dengan efek glassmorphism.
- **Live Search & Filter**: Pencarian instan (judul/sinopsis/genre) dengan debounce, plus filter genre berbentuk pill.
- **Sorting Fleksibel**: Rating Tertinggi, Terbaru, Terlama, atau A-Z.
- **Modal Detail Film**: Poster besar, sinopsis, rating, durasi, dan tautan ke TMDB.
- **Responsif**: Grid adaptif untuk HP, tablet, dan desktop.

---

## 📁 Struktur Proyek

```
Website Film/
├── frontend/             # Frontend (React + TypeScript + Tailwind + Vite)
│   ├── src/
│   │   ├── components/   # Header, FilterBar, MovieCard, MovieGrid, MovieModal
│   │   ├── App.tsx       # State utama & layout
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── src/                  # Backend & Scraper (Express + Cheerio + Axios)
│   ├── index.ts          # CLI Scraper standalone
│   ├── scraper.ts        # Logika scraping TMDB
│   ├── server.ts         # REST API server
│   ├── types.ts          # Interface tipe data
│   └── utils.ts          # JSON/CSV exporter
├── output/               # Hasil data film (movies.json & movies.csv)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Cara Menjalankan

Ada 2 cara mudah untuk menjalankan FazuraDex:

### 🌟 Cara Paling Mudah (1 Perintah untuk Semuanya)
Di folder `C:\Website Film`, jalankan:
```bash
npm run dev
```
Atau cukup **Double-Click file `start.bat`** di Windows Explorer!

Perintah ini akan secara otomatis menyalakan:
- **Backend API Server** di `http://localhost:4000`
- **Frontend Vite Web UI** di `http://localhost:5173`

Lalu buka browser Anda ke: **http://localhost:5173** (atau **http://localhost:4000**)

---

### 🛠️ Cara Manual (Dua Terminal Terpisah)

Jika ingin menjalankan secara terpisah:

1. **Terminal 1 (Backend API)**:
   ```bash
   npm run dev:api
   ```
2. **Terminal 2 (Frontend React UI)**:
   ```bash
   npm run dev:ui
   ```

---

### 🕷️ Menjalankan Scraper Saja (CLI)
Jika hanya ingin mengambil data film terbaru dan menyimpannya ke `output/movies.json` dan `output/movies.csv` tanpa menyalakan server web:
```bash
npm start
```

### 4. Kompilasi TypeScript (Opsional)
```bash
npm run build        # Backend
npm --prefix frontend run build   # Frontend (hasil di frontend/dist)
```

---

## ⚙️ Kustomisasi Pengaturan

Buka file `src/index.ts` dan ubah opsi pada objek `options`:

```typescript
const options = {
  pageCount: 3,        // Jumlah halaman yang ingin di-scrape (1 halaman = 20 film)
  fetchDetails: true,  // Set true untuk mengambil sinopsis & detail per film
};
```
