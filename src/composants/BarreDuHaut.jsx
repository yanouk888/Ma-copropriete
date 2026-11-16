import Cloche from './Cloche';

export const Chevron = (
  <svg className="chevron-titre" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

/** La barre du haut commune : à gauche ce qu'on lui donne, à droite la cloche, puis l'avatar. */
export default function BarreDuHaut({ children }) {
  const [gauche, avatar] = Array.isArray(children) ? children : [children, null];
  return (
    <header className="barre-titre">
      <div className="barre-titre-contenu">
        {gauche}
        <div className="actions-entete">
          <Cloche />
          {avatar}
        </div>
      </div>
    </header>
  );
}

