import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSession } from '../donnees/Session';

// La cloche de la barre du haut, comme dans Budget Maison : l'historique des
// notifications reçues, et leur nombre non lu. Les fonctions l'écrivent dans
// users/{uid}/notifications à chaque envoi (functions/src/envoyer.js) ; on le
// relit ici même quand les notifications poussées sont coupées sur l'appareil.

function ilYA(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`;
  if (min < 10080) return `il y a ${Math.floor(min / 1440)} j`;
  return d.toLocaleDateString('fr-CA');
}

export default function Cloche() {
  const { user } = useSession();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState([]);

  useEffect(() => onSnapshot(
    query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'), limit(30)),
    (r) => setListe(r.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setListe([])
  ), [user.uid]);

  const nonLues = liste.filter((n) => !n.read);
  const basculer = () => {
    // Ouvrir la cloche vaut lecture : tout passe à « lu ».
    if (!ouvert && nonLues.length) {
      const lot = writeBatch(db);
      nonLues.forEach((n) => lot.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true }));
      lot.commit().catch(() => {});
    }
    setOuvert(!ouvert);
  };

  return (
    <div className="menu-ancre">
      <button type="button" className="bouton-entete" onClick={basculer} aria-expanded={ouvert}
        aria-label={nonLues.length ? `Notifications, ${nonLues.length} non lue${nonLues.length > 1 ? 's' : ''}` : 'Notifications'}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill={nonLues.length ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
        {nonLues.length ? <span className="compteur">{nonLues.length > 9 ? '9+' : nonLues.length}</span> : null}
      </button>
      {ouvert ? (
        <>
          <div className="voile-menu" onClick={() => setOuvert(false)} />
          <div className="menu-deroulant menu-notifications" role="dialog" aria-label="Notifications">
            <div className="menu-titre">Notifications</div>
            {liste.length ? liste.map((n) => (
              <div key={n.id} className={`notif${n.read ? '' : ' non-lue'}`}>
                <strong>{n.title}</strong>
                {n.body ? <span>{n.body}</span> : null}
                <small>{ilYA(n.createdAt)}</small>
              </div>
            )) : <p className="discret menu-vide">Aucune notification pour l'instant.</p>}
          </div>
        </>
      ) : null}
    </div>
  );
}
