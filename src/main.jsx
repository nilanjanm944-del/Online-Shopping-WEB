import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './context/StoreProvider';
import { Toasts } from './components/ui';
import './index.css';

// Works at the domain root (Express/Docker) and under a sub-path, which is how
// GitHub Pages serves the site (for example /Online-Shopping-WEB/).
const BASE_URL = import.meta.env.BASE_URL || '/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={BASE_URL}>
      <StoreProvider>
        <App />
        <Toasts />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>
);

// PWA: register the offline fallback service worker (production only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE_URL}sw.js`).catch(() => {
      /* offline support is optional */
    });
  });
}
