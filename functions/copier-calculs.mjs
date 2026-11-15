// Recopie src/calc dans functions/calc avant chaque déploiement.
//
// Les fonctions ont besoin des mêmes calculs que l'application (qui doit
// combien, quand le solde passe sous zéro), et Firebase ne téléverse que le
// dossier functions/. Plutôt que d'écrire les calculs deux fois — et de les
// voir diverger au premier correctif —, on en garde une seule source et on la
// recopie. functions/calc n'est pas versionné.
import { cpSync, rmSync, readdirSync } from 'node:fs';

const source = new URL('../src/calc/', import.meta.url);
const cible = new URL('./calc/', import.meta.url);
rmSync(cible, { recursive: true, force: true });
cpSync(source, cible, { recursive: true, filter: (f) => !f.endsWith('.test.js') });
console.log('functions/calc :', readdirSync(cible).join(', '));
