// Kopiuje zbudowany APK do strony (../site/downloads) i aktualizuje ../site/version.json.
// Użycie: najpierw zbuduj podpisany APK w Android Studio, potem: npm run release -- "opis zmian"
// Skrypt sprawdza, czy APK ma tę samą wersję co package.json – inaczej nic nie kopiuje.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '..', 'site');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const dirs = [join(root, 'android', 'app', 'release'), join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release')];
const found = dirs
  .map((d) => ({ dir: d, apk: join(d, 'app-release.apk'), meta: join(d, 'output-metadata.json') }))
  .filter((c) => existsSync(c.apk))
  .sort((a, b) => statSync(b.apk).mtimeMs - statSync(a.apk).mtimeMs)[0];

if (!found) {
  console.error('✗ Nie znaleziono app-release.apk. Zbuduj go w Android Studio: Build → Generate Signed App Bundle / APK → APK → release.');
  process.exit(1);
}

// wersja zapisana przez Android Studio obok APK
let apkVersion = null;
if (existsSync(found.meta)) {
  const meta = JSON.parse(readFileSync(found.meta, 'utf8'));
  apkVersion = meta.elements?.[0]?.versionName ?? null;
}
if (apkVersion !== pkg.version) {
  console.error(`✗ APK ma wersję ${apkVersion ?? 'nieznaną'}, a package.json ${pkg.version}.`);
  console.error('  Najpierw: npm run android:sync, potem zbuduj podpisany APK w Android Studio i poczekaj, aż skończy.');
  process.exit(1);
}

// APK nie może być starszy niż ostatni build kodu (dist)
const distIndex = join(root, 'dist', 'index.html');
if (existsSync(distIndex) && statSync(found.apk).mtimeMs < statSync(distIndex).mtimeMs) {
  console.error('✗ APK jest starszy niż ostatni build kodu (dist). Zbuduj APK jeszcze raz w Android Studio.');
  process.exit(1);
}

mkdirSync(join(site, 'downloads'), { recursive: true });
const target = join(site, 'downloads', 'nawykomator.apk');
copyFileSync(found.apk, target);

const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');
if (md5(found.apk) !== md5(target)) {
  console.error('✗ Kopiowanie się nie udało (plik na stronie różni się od APK). Zamknij programy, które mogą go blokować, i spróbuj ponownie.');
  process.exit(1);
}

const notes = process.argv.slice(2).join(' ');
writeFileSync(
  join(site, 'version.json'),
  JSON.stringify({ version: pkg.version, apk: 'downloads/nawykomator.apk', notes, date: new Date().toISOString().slice(0, 10) }, null, 2) + '\n',
);
const mb = (statSync(target).size / 1048576).toFixed(1);
console.log(`✓ APK ${pkg.version} → site/downloads/nawykomator.apk (${mb} MB)`);
console.log('✓ site/version.json zaktualizowany');
console.log('Teraz: git add . ; git commit -m "..." ; git push – Render opublikuje nową wersję.');
