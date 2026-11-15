import { useId } from 'react';

/**
 * Le logo : un immeuble dont l'intérieur est un graphique qui monte — le
 * revenu locatif qui grandit jusqu'à payer l'immeuble. Le même dessin que
 * public/favicon.svg et les icônes de l'écran d'accueil.
 *
 * Dessiné en SVG ici plutôt que chargé en image : net à toutes les tailles,
 * rien à télécharger. useId : l'identifiant du dégradé doit être unique dans
 * la page, sinon deux logos affichés en même temps se volent leur dégradé.
 */
export default function Logo({ taille = 32 }) {
  const id = useId();
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#134e42" />
          <stop offset="1" stopColor="#2c8d76" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <path d="M13 29.5 32 15l19 14.5" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 27v20.5h28V27" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23" y="39" width="5" height="6" rx="1.5" fill="#b9f3e2" />
      <rect x="29.5" y="35" width="5" height="10" rx="1.5" fill="#b9f3e2" />
      <rect x="36" y="31" width="5" height="14" rx="1.5" fill="#ffe9a8" />
    </svg>
  );
}
