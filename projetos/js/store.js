/*
 * Armazenamento local (localStorage) dos clientes e projetos.
 * Os dados ficam no navegador do usuário; use Configurações > Backup para exportar/importar.
 */
(function () {
  'use strict';

  const KEY = 'gestao-projetos-pmbok8:v1';
  const empty = () => ({ version: 2, settings: { empresa: 'Minha Metalúrgica Ltda.', exemplo: false }, clientes: [], projetos: [] });
  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.projetos)) return migrar(parsed);
    } catch (e) { /* dados corrompidos ou storage bloqueado */ }
    return empty();
  }

  /*
   * Versão 1 não tinha cadastro de clientes: o cliente era um texto no projeto.
   * Cria um cliente para cada texto distinto e liga o projeto a ele.
   */
  function migrar(data) {
    if (!Array.isArray(data.clientes)) data.clientes = [];
    data.projetos.forEach((p) => {
      if (p.clienteId || !p.cliente) return;
      const interno = /\(interno\)/i.test(p.cliente);
      const nome = p.cliente.replace(/\s*\((interno|externo)\)\s*$/i, '').trim();
      let c = data.clientes.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
      if (!c) {
        c = { id: Ref.uid(), nome, tipo: interno ? 'interno' : 'externo', segmento: interno ? 'Interno' : '', criadoEm: new Date().toISOString() };
        data.clientes.push(c);
      }
      p.clienteId = c.id;
      delete p.cliente;
    });
    data.version = 2;
    return data;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      window.UI && UI.toast('Não foi possível salvar no navegador. Faça um backup em Configurações.', 'bad');
    }
  }

  function upsert(list, rec) {
    const now = new Date().toISOString();
    if (!rec.id) { rec.id = Ref.uid(); rec.criadoEm = now; }
    rec.atualizadoEm = now;
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    persist();
    return rec;
  }

  const Store = {
    projetos() { return db.projetos; },
    get(id) { return db.projetos.find((p) => p.id === id) || null; },
    save(p) { return upsert(db.projetos, p); },
    remove(id) {
      db.projetos = db.projetos.filter((p) => p.id !== id);
      persist();
    },

    clientes() { return db.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); },
    cliente(id) { return db.clientes.find((c) => c.id === id) || null; },
    clienteDe(p) { return p && p.clienteId ? Store.cliente(p.clienteId) : null; },
    projetosDoCliente(id) { return db.projetos.filter((p) => (p.clienteId || null) === (id || null)); },
    saveCliente(c) { return upsert(db.clientes, c); },
    // Só exclui cliente sem projetos, para não deixar projetos órfãos sem querer
    removeCliente(id) {
      if (Store.projetosDoCliente(id).length) throw new Error('Este cliente tem projetos. Mova ou exclua os projetos antes.');
      db.clientes = db.clientes.filter((c) => c.id !== id);
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
      db = migrar(data);
      persist();
    },
    replaceAll(dados, settings) {
      db.clientes = dados.clientes || [];
      db.projetos = dados.projetos;
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
