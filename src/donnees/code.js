// Alphabet sans I, O, 0 ni 1 : un code se dicte et se recopie à la main, les
// caractères qui se confondent coûtent plus qu'ils ne rapportent.
const LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGUEUR = 8;

/**
 * Nouveau code d'invitation, « COP-XXXXXXXX ».
 *
 * Huit caractères, soit 32^8 ≈ 10^12 combinaisons : le code EST le secret qui
 * ouvre les finances de la copropriété, il ne doit pas pouvoir s'énumérer.
 * Pour la même raison, crypto.getRandomValues et non Math.random, qui est
 * prédictible.
 */
export function nouveauCode() {
  const octets = new Uint32Array(LONGUEUR);
  crypto.getRandomValues(octets);
  // 32 divise 2^32 : le modulo ne biaise pas le tirage.
  return 'COP-' + Array.from(octets, (o) => LETTRES[o % LETTRES.length]).join('');
}

/** Remet en forme ce qui a été tapé : majuscules, sans espace ni tiret, préfixe rétabli. */
export function normaliserCode(saisie) {
  const brut = (saisie || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // « COP » en tête n'est retiré que si le reste a la bonne longueur : C et P
  // sont dans l'alphabet, un code peut commencer par ces lettres.
  const suffixe = brut.startsWith('COP') && brut.length === LONGUEUR + 3 ? brut.slice(3) : brut;
  return `COP-${suffixe}`;
}

export const codeValide = (code) => new RegExp(`^COP-[A-HJ-NP-Z2-9]{${LONGUEUR}}$`).test(code || '');

export const nouvelId = () => crypto.randomUUID().slice(0, 8);
