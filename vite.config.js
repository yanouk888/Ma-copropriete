import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { nouveautes } from './nouveautes.mjs';

// Horodatage calculé une fois par compilation. Il est compilé dans le bundle
// (la version qui tourne réellement sur l'appareil), écrit dans
// dist/version.json (la version déployée) et injecté dans le service worker :
// comparer les deux premiers dit s'il existe une mise à jour, et le troisième
// fait que le navigateur voit bien un nouveau service worker à chaque
// déploiement.
const BUILD_STAMP = new Date().toISOString();
const PLACEHOLDER = '__BUILD_STAMP__';

// package.json est la source de vérité du numéro de version (cf. CLAUDE.md).
const APP_VERSION = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
).version;

// Lève une erreur si la version n'a pas d'entrée au journal : c'est voulu, la
// note « Nouveautés » doit toujours être là.
const NOUVEAUTES = nouveautes(APP_VERSION, [new URL('./CHANGELOG.md', import.meta.url)]);

// Numéro de build lisible, qui change à chaque compilation sans que personne
// ait à y penser : de quoi comparer deux appareils d'un coup d'œil.
const BUILD_NUMBER = BUILD_STAMP.slice(0, 16).replace(/[-:]/g, '').replace('T', '.');

function empreinteDeBuild() {
  return {
    name: 'empreinte-de-build',
    apply: 'build',
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist');
      writeFileSync(
        resolve(dist, 'version.json'),
        JSON.stringify({ build: BUILD_STAMP, version: APP_VERSION, buildNumber: BUILD_NUMBER }, null, 2) + '\n',
        'utf8'
      );
      // Le service worker vient de public/ : Vite le recopie tel quel, `define`
      // ne s'y applique pas. On substitue après coup.
      const sw = resolve(dist, 'sw.js');
      if (existsSync(sw)) {
        const source = readFileSync(sw, 'utf8');
        if (!source.includes(PLACEHOLDER)) {
          // Mieux vaut un build qui échoue qu'un service worker jamais renouvelé.
          throw new Error(`${PLACEHOLDER} introuvable dans sw.js`);
        }
        writeFileSync(sw, source.split(PLACEHOLDER).join(BUILD_STAMP), 'utf8');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), empreinteDeBuild()],
  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_NUMBER__: JSON.stringify(BUILD_NUMBER),
    __NOUVEAUTES__: JSON.stringify(NOUVEAUTES),
  },
  build: { outDir: 'dist', sourcemap: false },
});
