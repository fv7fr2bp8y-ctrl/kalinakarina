// Чете публичната Drive папка (без API ключ) и записва photos.json.
// Пуска се от GitHub Action по график — така новите снимки в папката
// се появяват на сайта автоматично.
import { writeFile } from 'node:fs/promises';

const FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1zFGQeMylnjclWdnxaUdb1zBjAPZw9Z5S';
const IMAGE_RE = /\.(jpe?g|png|gif|webp|heic|avif)$/i;

const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#grid`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
});
if (!r.ok) throw new Error('Drive folder view ' + r.status);
const html = await r.text();

const seen = new Set();
const photos = [];
const re = /entry-([a-zA-Z0-9_-]{20,60})[\s\S]*?flip-entry-title[^>]*>([^<]+)</g;
let m;
while ((m = re.exec(html)) !== null) {
  const id = m[1];
  const name = m[2].trim();
  if (seen.has(id) || !IMAGE_RE.test(name)) continue;
  seen.add(id);
  photos.push({ id, name });
}

photos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

if (!photos.length) throw new Error('Няма намерени снимки — прекратявам, за да не изтрия списъка.');

await writeFile('photos.json', JSON.stringify({ updated: new Date().toISOString(), count: photos.length, photos }, null, 2));
console.log('photos.json updated:', photos.length, 'photos');
