// Чете публичната Drive папка (без API ключ) и записва photos.json с албуми.
// Свободните снимки в корена = албум ROOT_ALBUM. Всяка подпапка = отделен албум.
// Пуска се от GitHub Action по график → нови снимки/папки се появяват сами.
import { writeFile } from 'node:fs/promises';

const FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1zFGQeMylnjclWdnxaUdb1zBjAPZw9Z5S';
const ROOT_ALBUM = process.env.ROOT_ALBUM || 'Игри в парка';
const IMAGE_RE = /\.(jpe?g|png|gif|webp|heic|avif)$/i;

function byName(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

async function fetchFolder(id) {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}#grid`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!r.ok) throw new Error('folder view ' + r.status);
  return r.text();
}

function parseEntries(html) {
  const seen = new Set();
  const entries = [];
  const re = /entry-([a-zA-Z0-9_-]{20,60})[\s\S]*?flip-entry-title[^>]*>([^<]+)</g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    const name = m[2].trim();
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, name });
  }
  return entries;
}

const rootEntries = parseEntries(await fetchFolder(FOLDER_ID));
const rootPhotos = rootEntries.filter((e) => IMAGE_RE.test(e.name));
const candidates = rootEntries.filter((e) => !IMAGE_RE.test(e.name)); // подпапки (и не-снимки)

const albums = [];

// Всяка подпапка със снимки → албум. Не-папка/празна → тихо се пропуска.
for (const c of candidates) {
  try {
    const photos = parseEntries(await fetchFolder(c.id)).filter((e) => IMAGE_RE.test(e.name));
    if (photos.length) {
      photos.sort(byName);
      albums.push({ title: c.name, photos });
    }
  } catch { /* не е достъпна папка — пропускаме */ }
}

albums.sort((a, b) => a.title.localeCompare(b.title, 'bg'));

// Свободните снимки в корена отиват най-отпред.
if (rootPhotos.length) {
  rootPhotos.sort(byName);
  albums.unshift({ title: ROOT_ALBUM, photos: rootPhotos });
}

if (!albums.length) throw new Error('Няма намерени снимки — прекратявам, за да не изтрия списъка.');

const count = albums.reduce((n, a) => n + a.photos.length, 0);
await writeFile('photos.json', JSON.stringify({ updated: new Date().toISOString(), count, albums }, null, 2));
console.log('photos.json:', albums.length, 'албум(а),', count, 'снимки');
