importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);
  
  // Force development builds
  workbox.setConfig({ debug: false });

  // Updating SW lifecycle to update the app after user triggered refresh
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });
  
  // Cache the Google Fonts stylesheets with a stale-while-revalidate strategy
  workbox.routing.registerRoute(
    /^https:\/\/fonts\.googleapis\.com/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets',
    })
  );
  
  // Cache the underlying font files with a cache-first strategy for 1 year
  workbox.routing.registerRoute(
    /^https:\/\/fonts\.gstatic\.com/,
    new workbox.strategies.CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          maxEntries: 30,
        }),
      ],
    })
  );
  
  // Cache CSS, JS, and Web Worker files with a stale-while-revalidate strategy
  workbox.routing.registerRoute(
    /\.(?:js|css)$/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    })
  );
  
  // Cache images with a cache-first strategy
  workbox.routing.registerRoute(
    /\.(?:png|gif|jpg|jpeg|svg)$/,
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );
  
  // Use a stale-while-revalidate strategy for all other requests
  workbox.routing.setDefaultHandler(
    new workbox.strategies.StaleWhileRevalidate()
  );
  
  // Offline fallback
  workbox.routing.setCatchHandler(({ event }) => {
    // Return the precached offline page if a document is being requested
    if (event.request.destination === 'document') {
      return workbox.precaching.matchPrecache('/offline.html');
    }
    
    return Response.error();
  });
  
  // Background sync for scan logs
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('scanLogs', {
    maxRetentionTime: 24 * 60 // Retry for up to 24 Hours (specified in minutes)
  });
  
  workbox.routing.registerRoute(
    /\/api\/scanLogs/,
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin]
    }),
    'POST'
  );
} else {
  console.log(`Workbox didn't load`);
}