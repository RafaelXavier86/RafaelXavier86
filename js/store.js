/*
 * Armazenamento local (localStorage) com coleções de registros.
 * Os dados ficam no navegador do usuário; use Backup para exportar/importar.
 */
(function () {
  'use strict';

  const KEY = 'core-tools-iatf:v1';
  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.collections) return parsed;
    } catch (e) { /* dados corrompidos ou storage bloqueado */ }
    return { version: 1, settings: { empresa: 'Minha Empresa Ltda.', inspetor: '' }, collections: {} };
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      window.UI && UI.toast('Não foi possível salvar no navegador: ' + e.message, 'bad');
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function col(name) {
    if (!db.collections[name]) db.collections[name] = [];
    return db.collections[name];
  }

  const Store = {
    // Registros retornados são somente leitura; para editar, use uma cópia e chame save().
    all(name) {
      return col(name).slice();
    },
    get(name, id) {
      return col(name).find((r) => r.id === id) || null;
    },
    save(name, record) {
      const list = col(name);
      const now = new Date().toISOString();
      if (!record.id) {
        record.id = uid();
        record.criadoEm = now;
      }
      record.atualizadoEm = now;
      const copy = JSON.parse(JSON.stringify(record));
      const i = list.findIndex((r) => r.id === record.id);
      if (i >= 0) list[i] = copy; else list.push(copy);
      persist();
      return record;
    },
    remove(name, id) {
      db.collections[name] = col(name).filter((r) => r.id !== id);
      persist();
    },
    settings() {
      return Object.assign({}, db.settings);
    },
    saveSettings(s) {
      db.settings = Object.assign({}, db.settings, s);
      persist();
    },
    exportAll() {
      return JSON.stringify(db, null, 2);
    },
    importAll(json) {
      const data = JSON.parse(json);
      if (!data || typeof data.collections !== 'object') throw new Error('Arquivo de backup inválido.');
      db = data;
      persist();
    },
    clear() {
      db = { version: 1, settings: db.settings, collections: {} };
      persist();
    },
    isEmpty() {
      return Object.values(db.collections).every((l) => !l.length);
    },
    uid,
  };

  window.Store = Store;
})();
