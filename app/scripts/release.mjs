// Kopiuje zbudowany APK do strony (../site/downloads) i aktualizuje ../site/version.json.
// Użycie: najpierw zbuduj podpisany APK w Android Studio, potem: npm run release
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '..', 'site');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const candidates = [
  join(root, 'android', 'app', 'release', 'app-release.apk'),
  join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
];
const apk = candidates.filter(existsSync).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!apk) {
  console.error('Nie znaleziono app-release.apk. Zbuduj go w Android Studio: Build → Generate Signed App Bundle / APK → APK → release.');
  process.exit(1);
}

mkdirSync(join(site, 'downloads'), { recursive: true });
copyFileSync(apk, join(site, 'downloads', 'nawykomator.apk'));

const notes = process.argv.slice(2).join(' ');
writeFileSync(
  join(site, 'version.json'),
  JSON.stringify({ version: pkg.version, apk: 'downloads/nawykomator.apk', notes, date: new Date().toISOString().slice(0, 10) }, null, 2) + '\n',
);
const mb = (statSync(apk).size / 1048576).toFixed(1);
console.log(`✓ ${apk}\n  → site/downloads/nawykomator.apk (${mb} MB), version.json = ${pkg.version}`);
console.log('Teraz: git add, commit i push – Render sam opublikuje nową wersję.');
