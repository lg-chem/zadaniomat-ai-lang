const CACHE_NAME = 'zadaniomat-v3';

// Assets to cache on install
const STATIC_ASSETS = ['/manifest.json', '/icons/icon-192x192.png'];

// Pages that work without internet - opened instead of any other page when offline
const OFFLINE_HOME = '/notes';
const OFFLINE_PAGES = [OFFLINE_HOME];

// Shown when nothing was kept yet (the app wasn't opened logged in with internet)
const OFFLINE_HTML = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Brak internetu - Zadaniomat</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;box-sizing:border-box;background:#fff;color:#0f172a;text-align:center}
@media(prefers-color-scheme:dark){body{background:#020617;color:#e2e8f0}}button{margin-top:16px;padding:10px 18px;border-radius:8px;border:0;background:#3b82f6;color:#fff;font-size:15px}</style></head>
<body><div><h1 style="font-size:22px">Brak internetu</h1>
<p>Notatki działają bez internetu, gdy raz otworzysz aplikację zalogowany z internetem.</p>
<button onclick="location.reload()">Spróbuj ponownie</button></div></body></html>`;

// A response that can be kept and shown for a page (not a redirect to another one)
const isPageResponse = (response) =>
  response && response.ok && !response.redirected && response.type === 'basic';

// Keeps build files that aren't kept yet (their names hold a hash - they never change)
async function cacheMissing(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      if (await cache.match(url)) return;
      await cache.add(url).catch(() => {});
    })
  );
}

// Keeps a page with the build files it loads, so it can start offline
async function cachePageWithAssets(cache, path) {
  const response = await fetch(path, { credentials: 'same-origin' });
  // Not logged in (redirected to login) - nothing worth keeping
  if (!isPageResponse(response)) return;
  await cache.put(path, response.clone());
  const html = await response.text();
  // e.g. /_next/static/chunks/app/(dashboard)/notes/page-1a2b.js
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s\\<>]+/g) || [])];
  await cacheMissing(cache, assets);
}

// Getting ready for offline: the offline pages and the build files the app has
// loaded (also scripts loaded on demand, e.g. the editor). Asked by the app when
// it's open logged in with internet - at install the user may not be logged in.
async function prepareOffline(loadedUrls) {
  const cache = await caches.open(CACHE_NAME);
  const own = (loadedUrls || []).filter((url) => {
    try {
      const u = new URL(url, self.location.origin);
      return u.origin === self.location.origin && u.pathname.startsWith('/_next/static/');
    } catch (e) {
      return false;
    }
  });
  await Promise.all([
    cacheMissing(cache, own),
    ...OFFLINE_PAGES.map((path) => cachePageWithAssets(cache, path).catch(() => {})),
  ]);
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // One missing file mustn't stop the worker from installing
      await cacheMissing(cache, STATIC_ASSETS);
      await Promise.all(OFFLINE_PAGES.map((path) => cachePageWithAssets(cache, path).catch(() => {})));
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// A page opened without internet: Notes work offline, other pages need the
// server - so they open Notes instead of the browser's "no internet" page
async function offlinePage(url) {
  const cache = await caches.open(CACHE_NAME);
  const home = await cache.match(OFFLINE_HOME);
  if (isPageResponse(home)) {
    if (OFFLINE_PAGES.includes(url.pathname)) return home;
    return Response.redirect(new URL(OFFLINE_HOME, self.location.origin).href, 302);
  }
  return new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests - always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // Build files never change (their names hold a hash) - cache first, also offline
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Pages: always fresh from the server; without internet - see offlinePage
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep the offline pages up to date
          if (OFFLINE_PAGES.includes(url.pathname) && isPageResponse(response)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, responseClone));
          }
          return response;
        })
        .catch(() => offlinePage(url))
    );
    return;
  }

  // Other files (icons, page data for in-app navigation) - network first, cache as fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200 && !response.redirected) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 }))
      )
  );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Zadaniomat', options)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// ==================== OFFLINE NOTES ====================
// Notes written without internet wait in IndexedDB (see src/lib/note-outbox.ts -
// the database layout must match) and are sent from here when the connection is back.

const NOTES_DB = 'zadaniomat-offline';
const NOTES_DB_VERSION = 1;
const NOTE_OUTBOX = 'note-outbox';
const NOTE_LISTS = 'note-lists';

function openNotesDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTES_DB, NOTES_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTE_OUTBOX)) db.createObjectStore(NOTE_OUTBOX, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(NOTE_LISTS)) db.createObjectStore(NOTE_LISTS, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Removes a sent note - unless it was changed while sending, then it goes again
async function removeSentNote(db, id, rev, always) {
  const tx = db.transaction(NOTE_OUTBOX, 'readwrite');
  const store = tx.objectStore(NOTE_OUTBOX);
  const current = await idbRequest(store.get(id));
  if (current && (always || current.rev === rev)) store.delete(id);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function sendNote(entry) {
  const headers = { 'Content-Type': 'application/json' };
  if (entry.isNew) {
    // Sent with its id - sending again updates the note instead of making a copy
    return fetch('/api/notes', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ ...entry.fields, id: entry.id, workspaceType: entry.workspaceType, createdAt: entry.createdAt }),
    });
  }
  return fetch('/api/notes/' + entry.id, {
    method: 'PATCH',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(entry.fields),
  });
}

async function flushNotes() {
  const db = await openNotesDb();
  const entries = (await idbRequest(db.transaction(NOTE_OUTBOX).objectStore(NOTE_OUTBOX).getAll()))
    .sort((a, b) => a.queuedAt - b.queuedAt);

  let sent = 0;
  let dropped = 0;
  let result = 'done';
  for (const entry of entries) {
    let response;
    try {
      response = await sendNote(entry);
    } catch (error) {
      result = 'offline';
      break;
    }
    if (response.ok) {
      await removeSentNote(db, entry.id, entry.rev, false);
      sent++;
    } else if (response.status === 401) {
      // Logged out - waits until the user logs in again
      result = 'auth';
      break;
    } else if (response.status === 400 || response.status === 404 || response.status === 409) {
      // Can never be saved (e.g. the note was deleted on another device)
      await removeSentNote(db, entry.id, entry.rev, true);
      dropped++;
    } else {
      result = 'error';
      break;
    }
  }

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach((client) => client.postMessage({ type: 'notes-synced', sent, dropped, result }));
  return result;
}

// One sending at a time - the sync event and the page may ask at once
let notesFlush = null;
function flushNotesOnce() {
  if (!notesFlush) {
    notesFlush = flushNotes().finally(() => {
      notesFlush = null;
    });
  }
  return notesFlush;
}

// Background Sync (Android): runs when the connection is back, even with the app closed
self.addEventListener('sync', (event) => {
  if (event.tag !== 'notes-outbox') return;
  event.waitUntil(
    flushNotesOnce().then((result) => {
      // Makes the browser try again later
      if (result === 'offline' || result === 'error') throw new Error('Notes not sent yet');
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'flush-notes') {
    event.waitUntil(flushNotesOnce().catch(() => {}));
  }
  if (event.data && event.data.type === 'prepare-offline') {
    event.waitUntil(prepareOffline(event.data.urls).catch(() => {}));
  }
});
