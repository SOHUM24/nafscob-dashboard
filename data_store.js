/**
 * data_store.js — IndexedDB-powered persistence for uploaded dashboard data.
 *
 * Stores uploaded DCCB / STCB / PACS datasets keyed by type+year.
 * On page load the stored data is merged into the global JS objects
 * (DCCB_YEAR_DATA, STCB_DATA, PACS_DATA) so every chart picks it up
 * automatically.
 *
 * Public API (all return Promises):
 *   DataStore.save(type, year, stateData)   → void
 *   DataStore.loadAll(type)                  → [{id, type, year, data, uploadedAt}]
 *   DataStore.remove(id)                     → void
 *   DataStore.clear()                        → void
 *   DataStore.exportAll()                    → JSON string
 *   DataStore.importAll(json)                → void
 *   DataStore.mergeIntoGlobals()             → void  (call after default JS loads)
 */

window.DataStore = (() => {
  const DB_NAME = 'NAFSCOBDashboard';
  const DB_VERSION = 1;
  const STORE_NAME = 'datasets';

  /* ── helpers ── */
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('year', 'year', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, mode);
      const store = t.objectStore(STORE_NAME);
      const result = fn(store);
      t.oncomplete = () => { db.close(); resolve(result.__value); };
      t.onerror = () => { db.close(); reject(t.error); };
    }));
  }

  /* ── public ── */

  /**
   * Save a dataset.
   * @param {string} type  – 'DCCB' | 'STCB' | 'PACS'
   * @param {string} year  – e.g. '2025'
   * @param {object} stateData – { STATE_NAME: { metric: value, … }, … }
   */
  function save(type, year, stateData) {
    const id = `${type}_${year}`;
    const record = { id, type, year: String(year), data: stateData, uploadedAt: Date.now() };
    return tx('readwrite', store => { store.put(record); return { __value: undefined }; })
      .then(() => { notifyDataChanged(); });
  }

  /** Load all datasets, optionally filtered by type. */
  function loadAll(type) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, 'readonly');
      const store = t.objectStore(STORE_NAME);
      const req = type ? store.index('type').getAll(type) : store.getAll();
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = () => { db.close(); reject(req.error); };
    }));
  }

  /** Remove a single dataset by id. */
  function remove(id) {
    return tx('readwrite', store => { store.delete(id); return { __value: undefined }; })
      .then(() => { notifyDataChanged(); });
  }

  /** Clear ALL stored datasets. */
  function clear() {
    return tx('readwrite', store => { store.clear(); return { __value: undefined }; })
      .then(() => { notifyDataChanged(); });
  }

  /** Export every stored dataset as a JSON string. */
  async function exportAll() {
    const all = await loadAll();
    return JSON.stringify({ _export: 'NAFSCOB_Dashboard', _ts: Date.now(), datasets: all }, null, 2);
  }

  /** Import datasets from a previously-exported JSON string. */
  async function importAll(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    const arr = parsed?.datasets;
    if (!Array.isArray(arr)) throw new Error('Invalid export file');
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, 'readwrite');
      const store = t.objectStore(STORE_NAME);
      for (const rec of arr) {
        if (rec.id && rec.type && rec.data) store.put(rec);
      }
      t.oncomplete = () => { db.close(); notifyDataChanged(); resolve(); };
      t.onerror = () => { db.close(); reject(t.error); };
    });
  }

  function notifyDataChanged() {
    try { localStorage.setItem('nafscob_data_ts', String(Date.now())); } catch (_) {}
    try {
      const bc = new BroadcastChannel('nafscob_data');
      bc.postMessage({ type: 'data-updated' });
      bc.close();
    } catch (_) {}
  }

  /* ── merge helpers ── */

  function mergeDCCB(datasets) {
    // Merge into window.DCCB_YEAR_DATA = { STATE: { YEAR: {…} } }
    if (!window.DCCB_YEAR_DATA) window.DCCB_YEAR_DATA = {};
    for (const ds of datasets) {
      const year = ds.year;
      const stateData = ds.data;
      for (const [state, metrics] of Object.entries(stateData || {})) {
        const stateUpper = state.toUpperCase();
        if (!window.DCCB_YEAR_DATA[stateUpper]) window.DCCB_YEAR_DATA[stateUpper] = {};
        if (!window.DCCB_YEAR_DATA[stateUpper][year]) window.DCCB_YEAR_DATA[stateUpper][year] = {};
        Object.assign(window.DCCB_YEAR_DATA[stateUpper][year], metrics);
      }
    }
  }

  function mergeSTCB(datasets) {
    // Merge into window.STCB_DATA = { years:[], metrics:[], states:{ STATE:{ YEAR:{…} } } }
    if (!window.STCB_DATA) window.STCB_DATA = { years: [], metrics: [], states: {} };
    for (const ds of datasets) {
      const year = ds.year;
      if (!window.STCB_DATA.years.includes(year)) {
        window.STCB_DATA.years.push(year);
        window.STCB_DATA.years.sort();
      }
      for (const [state, metrics] of Object.entries(ds.data || {})) {
        const stateUpper = state.toUpperCase();
        if (!window.STCB_DATA.states[stateUpper]) window.STCB_DATA.states[stateUpper] = {};
        if (!window.STCB_DATA.states[stateUpper][year]) window.STCB_DATA.states[stateUpper][year] = {};
        Object.assign(window.STCB_DATA.states[stateUpper][year], metrics);
        // Add any new metrics
        for (const mk of Object.keys(metrics)) {
          if (!window.STCB_DATA.metrics.includes(mk)) window.STCB_DATA.metrics.push(mk);
        }
      }
    }
  }

  function mergePACS(datasets) {
    // Merge into window.PACS_DATA = { years:[], metrics:[], states:{ STATE:{ YEAR:{…} } } }
    if (!window.PACS_DATA) window.PACS_DATA = { years: [], metrics: [], states: {} };
    for (const ds of datasets) {
      const year = ds.year;
      if (!window.PACS_DATA.years.includes(year)) {
        window.PACS_DATA.years.push(year);
        window.PACS_DATA.years.sort();
      }
      for (const [state, metrics] of Object.entries(ds.data || {})) {
        const stateUpper = state.toUpperCase();
        if (!window.PACS_DATA.states[stateUpper]) window.PACS_DATA.states[stateUpper] = {};
        if (!window.PACS_DATA.states[stateUpper][year]) window.PACS_DATA.states[stateUpper][year] = {};
        Object.assign(window.PACS_DATA.states[stateUpper][year], metrics);
        for (const mk of Object.keys(metrics)) {
          if (!window.PACS_DATA.metrics.includes(mk)) window.PACS_DATA.metrics.push(mk);
        }
      }
    }
  }

  /** Merge all stored data into the global JS objects. Call after default scripts load. */
  async function mergeIntoGlobals() {
    try {
      const all = await loadAll();
      const dccb = all.filter(d => d.type === 'DCCB');
      const stcb = all.filter(d => d.type === 'STCB');
      const pacs = all.filter(d => d.type === 'PACS');
      if (dccb.length) mergeDCCB(dccb);
      if (stcb.length) mergeSTCB(stcb);
      if (pacs.length) mergePACS(pacs);
      console.log(`[DataStore] Merged ${all.length} stored datasets (DCCB:${dccb.length}, STCB:${stcb.length}, PACS:${pacs.length})`);
      return all.length;
    } catch (e) {
      console.warn('[DataStore] Merge failed:', e);
      return 0;
    }
  }

  /** Get a summary of stored datasets for display. */
  async function getSummary() {
    const all = await loadAll();
    return all.map(d => ({
      id: d.id,
      type: d.type,
      year: d.year,
      states: Object.keys(d.data || {}).length,
      uploadedAt: d.uploadedAt ? new Date(d.uploadedAt).toLocaleString() : '—'
    }));
  }

  return { save, loadAll, remove, clear, exportAll, importAll, mergeIntoGlobals, getSummary };
})();
