import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

export function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Tulis file JSON secara atomik menggunakan file temporer untuk mencegah korupsi data.
 * Aman di lingkungan serverless atau read-only (mengembalikan false alih-alih melempar error).
 */
export function safeWriteJson(filePath: string, data: unknown, pretty = false): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    fs.writeFileSync(tempFile, content, 'utf-8');
    fs.renameSync(tempFile, filePath);
    return true;
  } catch (err) {
    console.warn(`⚠️ Gagal menulis file aman ke ${filePath}:`, (err as Error).message);
    return false;
  }
}

/**
 * Simpan data menjadi file JSON.
 */
export function saveToJson<T>(fileName: string, data: T[]): string {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, fileName);
  safeWriteJson(filePath, data, true);
  return filePath;
}

/**
 * Konversi array data menjadi CSV lalu simpan ke file.
 */
export function saveToCsv<T extends Record<string, unknown>>(
  fileName: string,
  rows: T[],
): string {
  ensureOutputDir();
  if (rows.length === 0) {
    throw new Error('Tidak ada data untuk disimpan ke CSV.');
  }

  const headers = Object.keys(rows[0] as Record<string, unknown>);

  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = Array.isArray(value) ? value.join('; ') : String(value);
    // Bungkus dengan kutip jika mengandung koma, kutip, atau baris baru
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    const record = headers.map((h) => escapeCell(row[h])).join(',');
    lines.push(record);
  }

  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, `\uFEFF${lines.join('\n')}`, 'utf-8');
  return filePath;
}

/**
 * Jeda antar request agar tidak membanjiri server (rate-limiting sopan).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
