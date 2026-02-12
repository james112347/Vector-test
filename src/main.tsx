import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import UpdatePrompt, { initSW } from './components/UpdatePrompt';
import './index.css';

// Wire up service worker with UpdatePrompt component
initSW(registerSW);

// Register Periodic Background Sync (Chrome/Edge PWA only)
// This allows the browser to wake the service worker periodically
// even when the app is closed, so data stays fresh.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(async (registration) => {
    if ('periodicSync' in registration) {
      try {
        const status = await navigator.permissions.query({
          // @ts-expect-error periodicSync is not in the TS types yet
          name: 'periodic-background-sync',
        });
        if (status.state === 'granted') {
          // @ts-expect-error periodicSync is not in the TS types yet
          await registration.periodicSync.register('sahha-sync', {
            minInterval: 60 * 60 * 1000, // 1 hour minimum
          });
        }
      } catch {
        // Periodic sync not supported — no problem, we have foreground sync
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UpdatePrompt />
    <App />
  </React.StrictMode>
);
