import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

window.addEventListener('load', () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch((error) => {
      console.warn('Bonsai Journal service worker registration failed:', error);
    });
});
