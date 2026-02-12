/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

// Take control immediately
self.skipWaiting();
clientsClaim();

// When this new SW activates, force-reload all open tabs so they get the new code.
// This breaks the chicken-and-egg problem where old JS needs user interaction to update.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        client.navigate(client.url);
      }
    }),
  );
});

// Precache all build assets (injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback
const navHandler = createHandlerBoundToURL('/Vector-test/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    denylist: [/^\/Vector-test\/api/],
  }),
);

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// Cache images
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

/** Handle notification click: focus or open the app at the target URL. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/Vector-test/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

/** Clear badge when all notifications are dismissed. */
self.addEventListener('notificationclose', () => {
  self.registration.getNotifications().then((notifications) => {
    if (notifications.length === 0 && 'clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  });
});
