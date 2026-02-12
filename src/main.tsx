import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import UpdatePrompt, { initSW } from './components/UpdatePrompt';
import './index.css';

// Wire up service worker with UpdatePrompt component
initSW(registerSW);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UpdatePrompt />
    <App />
  </React.StrictMode>
);
