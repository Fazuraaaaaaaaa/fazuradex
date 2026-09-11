import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Simpan data menjadi file JSON.
 */
export function saveToJson<T>(fileName: string, data: T[]): string {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
