/*
 * Armazenamento local (localStorage do navegador).
 * Todo o histórico fica neste computador; use Configurações > Backup para guardar uma cópia em arquivo.
 */
(function () {
  'use strict';

  const KEY = 'rxr3d-orcamentos:v1';

  const CANAIS_PADRAO = [
    { id: 'direto', nome: 'Venda direta', ativo: true, teto: 0,
      obs: 'Venda ao cliente, sem taxa de plataforma.',
      faixas: [{ ate: null, comissao: 0, fixa: 0 }] },
    { id: 'ml-classico', nome: 'Mercado Livre — Clássico', ativo: true, teto: 0,
      obs: 'Comissão varia por categoria (aprox. 10% a 14%). Taxa fixa por unidade abaixo de R$ 79. Acima de R$ 79 o vendedor paga parte do frete grátis: informe-o em "Frete" como absorvido.',
      faixas: [
        { ate: 29, comissao: 12, fixa: 6.25 },
        { ate: 50, comissao: 12, fixa: 6.5 },
        { ate: 79, comissao: 12, fixa: 6.75 },
        { ate: null, comissao: 12, fixa: 0 },
      ] },
    { id: 'ml-premium', nome: 'Mercado Livre — Premium', ativo: true, teto: 0,
      obs: 'Comissão varia por categoria (aprox. 15% a 19%), com parcelamento sem juros ao comprador.',
      faixas: [
        { ate: 29, comissao: 17, fixa: 6.25 },
        { ate: 50, comissao: 17, fixa: 6.5 },
        { ate: 79, comissao: 17, fixa: 6.75 },
        { ate: null, comissao: 17, fixa: 0 },
      ] },
    { id: 'shopee', nome: 'Shopee', ativo: true, teto: 100,
      obs: 'Comissão + programa de frete grátis, taxa fixa por item vendido e teto de comissão por item. Confira a tabela vigente para o seu tipo de conta (CPF/CNPJ).',
      faixas: [{ ate: null, comissao: 20, fixa: 4 }] },
  ];

  function defaults() {
    return {
      version: 1,
      settings: {
        empresa: {
          nome: 'RXR 3D', documento: '', endereco: '', cidade: '', telefone: '', email: '', site: '',
        },
        params: {
          tarifaKwh: 0.95,
          vidaUtilH: 5000,
          manutencaoH: 0.3,
          taxaFalha: 5,
          custoFixoMensal: 0,
          horasMes: 200,
          imposto: 0,
          acabamentoPct: 5,
          projetoPct: 30,
          margemPadrao: 40,
        },
        orcamento: {
          validadeDias: 7,
          condicoes: 'Pagamento: 50% na aprovação e 50% na entrega (Pix, cartão ou dinheiro).\nPrazo de produção a combinar após aprovação.\nCores e acabamento conforme combinado. Peças impressas em 3D podem apresentar linhas de camada.',
        },
        canais: JSON.parse(JSON.stringify(CANAIS_PADRAO)),
        seqOrcamento: 0,
        ultimoBackup: null,
      },
      collections: {},
    };
  }

  let db = load();

  function load() {
    const base = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.collections) return merge(base, parsed);
    } catch (e) { /* dados corrompidos ou armazenamento bloqueado */ }
    return base;
  }

  function merge(base, data) {
    const s = data.settings || {};
    data.settings = Object.assign({}, base.settings, s, {
      empresa: Object.assign({}, base.settings.empresa, s.empresa),
      params: Object.assign({}, base.settings.params, s.params),
      orcamento: Object.assign({}, base.settings.orcamento, s.orcamento),
      canais: (s.canais && s.canais.length) ? s.canais : base.settings.canais,
    });
    return data;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      window.UI && UI.toast('Não foi possível salvar no navegador: ' + e.message, 'bad');
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function col(name) {
    if (!db.collections[name]) db.collections[name] = [];
    return db.collections[name];
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  const Store = {
    CANAIS_PADRAO,
    all(name) { return col(name).map(clone); },
    get(name, id) { const r = col(name).find((x) => x.id === id); return r ? clone(r) : null; },
    save(name, record) {
      const list = col(name);
      const now = new Date().toISOString();
      record = clone(record);
      if (!record.id) {
        record.id = uid();
        record.criadoEm = now;
        list.push(record);
      } else {
        const i = list.findIndex((r) => r.id === record.id);
        if (i >= 0) list[i] = record; else list.push(record);
      }
      record.atualizadoEm = now;
      persist();
      return clone(record);
    },
    remove(name, id) {
      db.collections[name] = col(name).filter((r) => r.id !== id);
      persist();
    },
    settings() { return clone(db.settings); },
    setSettings(patch) {
      db.settings = Object.assign(db.settings, clone(patch));
      persist();
    },
    nextNumero() {
      db.settings.seqOrcamento = (db.settings.seqOrcamento || 0) + 1;
      persist();
      return db.settings.seqOrcamento;
    },
    /** imagens: { id: dataURL } guardadas no IndexedDB, incluídas no mesmo arquivo. */
    exportJSON(imagens) {
      db.settings.ultimoBackup = new Date().toISOString();
      persist();
      return JSON.stringify(Object.assign({ app: 'rxr3d-orcamentos', exportadoEm: new Date().toISOString() }, db, { imagens: imagens || {} }));
    },
    /** Restaura os dados e devolve o mapa de imagens do backup (ou null em backups antigos). */
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || !data.collections || !data.settings) throw new Error('Arquivo não é um backup deste sistema.');
      const imagens = data.imagens || null;
      delete data.imagens; delete data.app; delete data.exportadoEm;
      db = merge(defaults(), data);
      persist();
      return imagens;
    },
    reset() {
      db = defaults();
      persist();
    },
    usage() {
      try { return (localStorage.getItem(KEY) || '').length; } catch (e) { return 0; }
    },
    uid,
  };

  window.Store = Store;

  // Pede ao navegador para não apagar os dados automaticamente.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
})();
