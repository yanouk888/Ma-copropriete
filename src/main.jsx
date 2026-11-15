import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { demarrerVeilleMiseAJour } from './donnees/miseAJour';

// Avant même le premier rendu : au démarrage, rien n'est encore saisi, c'est
// le moment le plus sûr pour recharger vers une nouvelle version.
demarrerVeilleMiseAJour();

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
