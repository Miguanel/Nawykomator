// Poprawki projektu Android po `npx cap add android` / `npx cap sync android`.
// Można uruchamiać wiele razy – zmienia tylko to, czego brakuje.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
if (!existsSync(android)) {
  console.error('Brak folderu android/. Najpierw: npx cap add android');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map((x) => parseInt(x, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;

// 1) wersja apki z package.json
const gradlePath = join(android, 'app', 'build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
writeFileSync(gradlePath, gradle);
console.log(`✓ wersja ${pkg.version} (versionCode ${versionCode})`);

// 2) uprawnienia (powiadomienia i mikrofon dodają same wtyczki; tu brakujące)
const manifestPath = join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
const perms = ['android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.RECORD_AUDIO', 'android.permission.POST_NOTIFICATIONS'];
for (const p of perms) {
  if (!manifest.includes(p)) {
    manifest = manifest.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
    console.log(`✓ uprawnienie ${p}`);
  }
}
writeFileSync(manifestPath, manifest);

// 3) mała ikonka powiadomień (biała, wektorowa)
const drawable = join(android, 'app', 'src', 'main', 'res', 'drawable');
mkdirSync(drawable, { recursive: true });
writeFileSync(
  join(drawable, 'ic_stat_nawyk.xml'),
  `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF"
      android:pathData="M12,2A10,10 0,1 0,22 12,10 10,0 0,0 12,2ZM10.6,16.2l-4.2,-4.2 1.4,-1.4 2.8,2.8 5.8,-5.8 1.4,1.4Z"/>
</vector>
`,
);
console.log('✓ ikonka powiadomień ic_stat_nawyk');

// 4) więcej pamięci dla Gradle + Kotlin bez osobnego demona (demon wysypywał się na Windows)
const propsPath = join(android, 'gradle.properties');
let props = readFileSync(propsPath, 'utf8');
props = props.replace(/org\.gradle\.jvmargs=.*/, 'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8');
if (!props.includes('kotlin.compiler.execution.strategy')) {
  props += '\nkotlin.compiler.execution.strategy=in-process\nkotlin.daemon.jvmargs=-Xmx2048m\n';
}
writeFileSync(propsPath, props);
console.log('✓ gradle.properties (pamięć, Kotlin in-process)');
console.log('Gotowe.');
