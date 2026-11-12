import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './context/StoreProvider';
import { Toasts } from './components/ui';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
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
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
