// Minimal IndexedDB wrapper. Two stores: "kv" (structured library data) and "files" (imported audio Blobs).
const DB_NAME = 'disc';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available in this browser.'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open the local database.'));
      req.onblocked = () => reject(new Error('The local database is blocked by another tab.'));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted (the browser may be out of space).'));
  });
}

export const kvGet = (key) => run('kv', 'readonly', (s) => s.get(key));
export const kvSet = (key, value) => run('kv', 'readwrite', (s) => s.put(value, key));
export const kvDelete = (key) => run('kv', 'readwrite', (s) => s.delete(key));
export const fileGet = (key) => run('files', 'readonly', (s) => s.get(key));
export const filePut = (key, blob) => run('files', 'readwrite', (s) => s.put(blob, key));
export const fileDelete = (key) => run('files', 'readwrite', (s) => s.delete(key));
export const filesClear = () => run('files', 'readwrite', (s) => s.clear());
export const kvClear = () => run('kv', 'readwrite', (s) => s.clear());

/** Close the cached connection (used by tests and after clearing all data). */
export async function resetConnection() {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
}

export async function estimateStorage() {
  try {
    if (navigator?.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch {
    /* ignore */
  }
  return null;
}
