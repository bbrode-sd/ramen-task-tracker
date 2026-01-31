/**
 * Tomobodo Service Worker
 * 
 * Provides offline support by caching static assets and the app shell.
 * Firestore handles data persistence through IndexedDB, so this SW
 * focuses on caching the app itself for offline access.
 * 
 * Test scenarios:
 * 1. Load app while offline - should serve cached shell
 * 2. Create/edit cards offline - Firestore cache handles data
 * 3. Reload while offline - should work from cache
 * 4. Come back online - app should sync automatically
 */

const CACHE_NAME = 'tomobodo-v2';

// Static assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fall back to cache
  networkFirst: async (request) => {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  },

  // Cache first, fall back to network
  cacheFirst: async (request) => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  },

  // Stale while revalidate
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(() => {
      // Network failed, but we might have a cached version
      return cachedResponse;
    });

    return cachedResponse || fetchPromise;
  },
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Firebase and API requests - let Firestore handle its own caching
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase.google.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy based on request type
  let strategy;

  if (url.pathname.startsWith('/_next/static/')) {
    // Static Next.js assets - cache first (they're versioned)
    strategy = CACHE_STRATEGIES.cacheFirst;
  } else if (url.pathname.match(/\.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/)) {
    // Other static assets - stale while revalidate
    strategy = CACHE_STRATEGIES.staleWhileRevalidate;
  } else {
    // HTML pages and other resources - network first
    strategy = CACHE_STRATEGIES.networkFirst;
  }

  event.respondWith(
    strategy(request).catch((error) => {
      console.error('[SW] Fetch failed:', error);
      
      // Return offline page for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/').then((response) => {
          if (response) {
            return response;
          }
          // Last resort: return a simple offline message
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:system-ui;text-align:center;padding:2rem;"><h1>🍜</h1><p>You\'re offline. Please check your connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      }
      
      throw error;
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
