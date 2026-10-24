/*
 * Armazenamento local (localStorage) dos projetos.
 * Os dados ficam no navegador do usuário; use Configurações > Backup para exportar/importar.
 */
(function () {
  'use strict';

  const KEY = 'gestao-projetos-pmbok8:v1';
  const empty = () => ({ version: 1, settings: { empresa: 'Minha Metalúrgica Ltda.', exemplo: false }, projetos: [] });
  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.projetos)) return parsed;
    } catch (e) { /* dados corrompidos ou storage bloqueado */ }
    return empty();
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      window.UI && UI.toast('Não foi possível salvar no navegador. Faça um backup em Configurações.', 'bad');
    }
  }

  const Store = {
    projetos() { return db.projetos; },
    get(id) { return db.projetos.find((p) => p.id === id) || null; },
    save(p) {
      const now = new Date().toISOString();
      if (!p.id) { p.id = Ref.uid(); p.criadoEm = now; }
      p.atualizadoEm = now;
      const i = db.projetos.findIndex((x) => x.id === p.id);
      if (i >= 0) db.projetos[i] = p; else db.projetos.push(p);
      persist();
      return p;
    },
    remove(id) {
      db.projetos = db.projetos.filter((p) => p.id !== id);
      persist();
    },
    settings() { return Object.assign({}, db.settings); },
    saveSettings(s) {
      db.settings = Object.assign({}, db.settings, s);
      persist();
    },
    exportAll() { return JSON.stringify(db, null, 2); },
    importAll(json) {
      const data = JSON.parse(json);
      if (!data || !Array.isArray(data.projetos)) throw new Error('O arquivo não é um backup desta aplicação.');
      db = data;
      persist();
    },
    replaceAll(projetos, settings) {
      db.projetos = projetos;
      db.settings = Object.assign({}, db.settings, settings);
      persist();
    },
    clear() {
      db = Object.assign(empty(), { settings: Object.assign({}, db.settings, { exemplo: false }) });
      persist();
    },
    nextCode() {
      const ano = new Date().getFullYear();
      const usados = db.projetos.map((p) => /^PRJ-(\d{4})-(\d+)$/.exec(p.codigo || '')).filter((m) => m && +m[1] === ano).map((m) => +m[2]);
      return `PRJ-${ano}-${String(Math.max(0, ...usados) + 1).padStart(3, '0')}`;
    },
  };

  window.Store = Store;
})();
